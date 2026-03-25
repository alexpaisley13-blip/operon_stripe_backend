import Stripe from 'stripe';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Stripe client singleton
// ---------------------------------------------------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  appInfo: {
    name: 'operon-stripe-backend',
    version: '1.0.0',
  },
});

export default stripe;

function getStateSecret() {
  const secret = process.env.STRIPE_STATE_SECRET;
  if (!secret) {
    throw new Error(
      'STRIPE_STATE_SECRET is not set. ' +
        'Add a long random string to your environment variables. ' +
        'Do not reuse STRIPE_SECRET_KEY for this purpose.'
    );
  }
  return secret;
}

/**
 * Build the Stripe Connect OAuth authorisation URL.
 *
 * The `state` parameter is a cryptographically signed JWT-like token that
 * encodes { business_id, user_id, nonce } so we can validate it on callback
 * without a round-trip to the database.
 *
 * @param {string} business_id
 * @param {string} user_id
 * @returns {{ url: string, state: string }}
 */
export function buildAuthorizationUrl(business_id, user_id) {
  const nonce = crypto.randomBytes(32).toString('hex');

  // Encode state as a base64url-encoded JSON payload + HMAC signature.
  // This avoids needing a separate DB table just for state tokens while
  // still being verifiable and tamper-proof.
  const payload = Buffer.from(
    JSON.stringify({ business_id, user_id, nonce, ts: Date.now() })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex');

  const state = `${payload}.${signature}`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.STRIPE_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: process.env.STRIPE_REDIRECT_URI,
    state,
  });

  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  return { url, state };
}

/**
 * Verify a `state` value that was returned by Stripe on the callback.
 *
 * Returns the decoded payload `{ business_id, user_id, nonce, ts }` if valid,
 * or throws an Error if the signature does not match or the token is stale.
 *
 * @param {string} state
 * @returns {{ business_id: string, user_id: string, nonce: string, ts: number }}
 */
export function verifyState(state) {
  const dotIndex = state.lastIndexOf('.');
  if (dotIndex === -1) {
    throw new Error('Invalid state format');
  }

  const payload = state.slice(0, dotIndex);
  const receivedSig = state.slice(dotIndex + 1);

  const expectedSig = crypto
    .createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (
    receivedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'))
  ) {
    throw new Error('State signature verification failed');
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('State payload could not be decoded');
  }

  // Reject tokens older than 30 minutes
  const MAX_AGE_MS = 30 * 60 * 1000;
  if (Date.now() - decoded.ts > MAX_AGE_MS) {
    throw new Error('State token has expired');
  }

  return decoded;
}

/**
 * Exchange an OAuth authorisation code for access/refresh tokens.
 *
 * @param {string} code  The `code` query param returned by Stripe
 * @returns {Promise<Stripe.OAuthToken>}
 */
export async function exchangeOAuthCode(code) {
  return stripe.oauth.token({
    grant_type: 'authorization_code',
    code,
  });
}

/**
 * Retrieve a connected Stripe account by its ID.
 *
 * @param {string} accountId  e.g. "acct_..."
 * @returns {Promise<Stripe.Account>}
 */
export async function retrieveAccount(accountId) {
  return stripe.accounts.retrieve(accountId);
}

/**
 * Deauthorise (disconnect) a connected Stripe account from this platform.
 *
 * @param {string} accountId  e.g. "acct_..."
 * @returns {Promise<Stripe.OAuthDeauthorization>}
 */
export async function deauthorizeAccount(accountId) {
  return stripe.oauth.deauthorize({
    client_id: process.env.STRIPE_CLIENT_ID,
    stripe_user_id: accountId,
  });
}

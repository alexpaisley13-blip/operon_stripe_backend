import { NextResponse } from 'next/server';
import { errorResponse } from '../../../../lib/auth.js';
import {
  verifyState,
  exchangeOAuthCode,
  retrieveAccount,
} from '../../../../lib/stripe.js';
import { query, getClient } from '../../../../lib/db.js';

function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error(
      'APP_URL is not set. Add the public URL of your Operon frontend to your environment variables.'
    );
  }
  return url;
}

/**
 * GET /api/stripe/callback
 *
 * Handles the OAuth redirect back from Stripe after the user authorises
 * (or denies) the connection.
 *
 * Query params provided by Stripe:
 *   code  — authorisation code to exchange for tokens
 *   state — our tamper-proof state token
 *   error / error_description — present when the user denies access
 *
 * On success:  redirects to ${APP_URL}/settings/stripe?connected=true
 * On failure:  redirects to ${APP_URL}/settings/stripe?error=<reason>
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const stripeError = searchParams.get('error');
  const stripeErrorDesc = searchParams.get('error_description');

  // ── 1. Handle explicit denial from Stripe ─────────────────────────────────
  if (stripeError) {
    console.warn('[stripe/callback] Stripe returned an error:', stripeError, stripeErrorDesc);
    return redirectToFrontend('error', encodeURIComponent(stripeError));
  }

  // ── 2. Require both code and state ────────────────────────────────────────
  if (!code || !state) {
    return redirectToFrontend('error', 'missing_params');
  }
  // ── 3. Verify the state token ─────────────────────────────────────────────
  let statePayload;
  try {
    statePayload = verifyState(state);
  } catch (err) {
    console.warn('[stripe/callback] State verification failed:', err.message);
    return redirectToFrontend('error', 'invalid_state');
  }

  const { business_id, user_id } = statePayload;

  // ── 4. Exchange code with Stripe ──────────────────────────────────────────
  let oauthToken;
  try {
    oauthToken = await exchangeOAuthCode(code);
  } catch (err) {
    console.error('[stripe/callback] OAuth token exchange failed:', err.message);
    return redirectToFrontend('error', 'token_exchange_failed');
  }

  const {
    access_token,
    refresh_token,
    stripe_user_id: stripe_account_id,
    scope,
    livemode,
  } = oauthToken;

  // ── 5. Retrieve the connected account details ──────────────────────────────
  let account;
  try {
    account = await retrieveAccount(stripe_account_id);
  } catch (err) {
    console.error('[stripe/callback] Failed to retrieve Stripe account:', err.message);
    return redirectToFrontend('error', 'account_retrieval_failed');
  }

  const {
    email: stripe_account_email,
    type: stripe_account_type,
    details_submitted,
    charges_enabled,
    payouts_enabled,
    country,
    default_currency,
  } = account;

  // ── 6. Persist to PostgreSQL (transaction) ────────────────────────────────
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Upsert the stripe_connections row
    await client.query(
      `INSERT INTO stripe_connections (
          business_id,
          user_id,
          stripe_account_id,
          stripe_account_email,
          stripe_account_type,
          details_submitted,
          charges_enabled,
          payouts_enabled,
          country,
          default_currency,
          raw_account_json,
          access_token,
          refresh_token,
          scope,
          livemode,
          connected_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          NOW(), NOW()
        )
        ON CONFLICT (stripe_account_id) DO UPDATE SET
          business_id          = EXCLUDED.business_id,
          user_id              = EXCLUDED.user_id,
          stripe_account_email = EXCLUDED.stripe_account_email,
          stripe_account_type  = EXCLUDED.stripe_account_type,
          details_submitted    = EXCLUDED.details_submitted,
          charges_enabled      = EXCLUDED.charges_enabled,
          payouts_enabled      = EXCLUDED.payouts_enabled,
          country              = EXCLUDED.country,
          default_currency     = EXCLUDED.default_currency,
          raw_account_json     = EXCLUDED.raw_account_json,
          access_token         = EXCLUDED.access_token,
          refresh_token        = EXCLUDED.refresh_token,
          scope                = EXCLUDED.scope,
          livemode             = EXCLUDED.livemode,
          updated_at           = NOW()`,
      [
        business_id,
        user_id,
        stripe_account_id,
        stripe_account_email,
        stripe_account_type,
        details_submitted,
        charges_enabled,
        payouts_enabled,
        country,
        default_currency,
        JSON.stringify(account),
        access_token,
        refresh_token,
        scope,
        livemode,
      ]
    );

    // Mark the business as stripe_connected = true
    await client.query(
      `UPDATE businesses
          SET stripe_connected = TRUE, updated_at = NOW()
        WHERE id = $1`,
      [business_id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[stripe/callback] DB transaction failed:', err.message);
    return redirectToFrontend('error', 'db_error');
  } finally {
    client.release();
  }

  // ── 7. Return user to Operon frontend ─────────────────────────────────────
  return redirectToFrontend('success', stripe_account_id);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a redirect response back to the Operon frontend.
 *
 * @param {'success'|'error'} status
 * @param {string}            value   stripe_account_id on success, error code on failure
 */
function redirectToFrontend(status, value) {
  const destination = new URL(`${getAppUrl()}/stripe/success`);
  if (status === 'success') {
    destination.searchParams.set('connected', 'true');
    destination.searchParams.set('account', value);
  } else {
    destination.searchParams.set('connected', 'false');
    destination.searchParams.set('error', value);
  }
  return NextResponse.redirect(destination.toString());
}

import { NextResponse } from 'next/server';
import { requireAuth, errorResponse } from '../../../../lib/auth.js';
import { buildAuthorizationUrl } from '../../../../lib/stripe.js';

/**
 * GET /api/stripe/connect
 *
 * Initiates the Stripe Connect OAuth flow.
 *
 * 1. Validates the caller's Operon JWT.
 * 2. Builds a tamper-proof `state` token encoding the business_id and user_id.
 * 3. Redirects the browser to Stripe's OAuth authorisation page.
 *
 * Front-end usage:
 *   window.location.href = '/api/stripe/connect'
 *   (with the Authorization header set as a cookie or via a redirect from
 *    a page that already has the token stored in a secure cookie)
 *
 * Alternatively the front-end can call this endpoint, receive the `url`
 * in the JSON response, and then navigate the user there.
 */
export async function GET(request) {
  let authPayload;
  try {
    authPayload = requireAuth(request);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { business_id, user_id } = authPayload;
const secret = Buffer.from(process.env.JWT_SECRET, 'base64url').toString();
  if (!process.env.STRIPE_CLIENT_ID) {
    return errorResponse('STRIPE_CLIENT_ID is not configured on the server', 500);
  }

  if (!process.env.STRIPE_REDIRECT_URI) {
    return errorResponse('STRIPE_REDIRECT_URI is not configured on the server', 500);
  }

  try {
    const { url } = buildAuthorizationUrl(business_id, user_id);

    // If this request was made from the browser directly (not an API fetch),
    // redirect to Stripe. If it was a fetch from front-end JavaScript, return
    // the URL in JSON so the client can navigate.
    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({ success: true, url });
    }

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('[stripe/connect] Failed to build authorization URL:', err);
    return errorResponse('Failed to start Stripe Connect flow', 500);
  }
}

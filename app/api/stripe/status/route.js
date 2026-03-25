import { NextResponse } from 'next/server';
import { requireAuth, errorResponse } from '../../../../lib/auth.js';
import { query } from '../../../../lib/db.js';

/**
 * GET /api/stripe/status
 *
 * Returns the current Stripe connection status for the authenticated
 * Operon business.
 *
 * Response (connected):
 * {
 *   success: true,
 *   connected: true,
 *   account: {
 *     stripe_account_id: "acct_...",
 *     stripe_account_email: "...",
 *     stripe_account_type: "standard",
 *     details_submitted: true,
 *     charges_enabled: true,
 *     payouts_enabled: true,
 *     country: "US",
 *     default_currency: "usd",
 *     livemode: false,
 *     connected_at: "2024-01-01T00:00:00.000Z"
 *   }
 * }
 *
 * Response (not connected):
 * { success: true, connected: false, account: null }
 */
export async function GET(request) {
  let authPayload;
  try {
    authPayload = requireAuth(request);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { business_id } = authPayload;

  try {
    const result = await query(
      `SELECT
          stripe_account_id,
          stripe_account_email,
          stripe_account_type,
          details_submitted,
          charges_enabled,
          payouts_enabled,
          country,
          default_currency,
          livemode,
          connected_at
        FROM stripe_connections
        WHERE business_id = $1
        ORDER BY connected_at DESC
        LIMIT 1`,
      [business_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, connected: false, account: null });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      account: result.rows[0],
    });
  } catch (err) {
    console.error('[stripe/status] DB query failed:', err.message);
    return errorResponse('Failed to retrieve Stripe connection status', 500);
  }
}

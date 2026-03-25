import { NextResponse } from 'next/server';
import { requireAuth, errorResponse } from '../../../../lib/auth.js';
import { deauthorizeAccount } from '../../../../lib/stripe.js';
import { query, getClient } from '../../../../lib/db.js';

/**
 * POST /api/stripe/disconnect
 *
 * Removes the Stripe connection for the authenticated Operon business.
 *
 * Steps:
 * 1. Validate the caller's Operon JWT.
 * 2. Look up the existing connection for this business.
 * 3. Call Stripe's OAuth deauthorise endpoint so the platform token is revoked.
 * 4. Delete the stripe_connections row.
 * 5. Set businesses.stripe_connected = false.
 *
 * Response:
 * { success: true, message: "Stripe account disconnected" }
 */
export async function POST(request) {
  let authPayload;
  try {
    authPayload = requireAuth(request);
  } catch (err) {
    return errorResponse(err.message, err.status || 401);
  }

  const { business_id } = authPayload;

  // ── 1. Look up the existing connection ────────────────────────────────────
  let existingConnection;
  try {
    const result = await query(
      `SELECT id, stripe_account_id
         FROM stripe_connections
        WHERE business_id = $1
        LIMIT 1`,
      [business_id]
    );

    if (result.rows.length === 0) {
      return errorResponse('No Stripe connection found for this business', 404);
    }

    existingConnection = result.rows[0];
  } catch (err) {
    console.error('[stripe/disconnect] DB lookup failed:', err.message);
    return errorResponse('Database error while looking up Stripe connection', 500);
  }

  // ── 2. Deauthorise on Stripe's side ──────────────────────────────────────
  // We attempt this before touching the DB. If Stripe returns an error we
  // still proceed with the local removal so the user is never stuck in a
  // broken half-connected state.
  try {
    await deauthorizeAccount(existingConnection.stripe_account_id);
  } catch (err) {
    // Log but do not abort — the local record will still be removed.
    console.warn(
      '[stripe/disconnect] Stripe deauthorise call failed (proceeding with local removal):',
      err.message
    );
  }

  // ── 3. Remove local record + clear business flag (transaction) ────────────
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM stripe_connections WHERE id = $1`,
      [existingConnection.id]
    );

    await client.query(
      `UPDATE businesses
          SET stripe_connected = FALSE, updated_at = NOW()
        WHERE id = $1`,
      [business_id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[stripe/disconnect] DB transaction failed:', err.message);
    return errorResponse('Failed to remove Stripe connection from database', 500);
  } finally {
    client.release();
  }

  return NextResponse.json({ success: true, message: 'Stripe account disconnected' });
}

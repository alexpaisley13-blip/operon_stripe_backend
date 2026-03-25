import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET
  ? Buffer.from(process.env.JWT_SECRET, 'base64url').toString()
  : undefined;

/**
 * Extract and verify the Operon JWT from the Authorization header.
 *
 * Returns the decoded payload on success, or throws an error with a
 * human-readable `message` property on failure.
 *
 * Expected token shape (adjust field names to match your Operon JWT):
 * {
 *   sub:         "<user_id>",       // UUID of the authenticated user
 *   business_id: "<business_id>",   // UUID of the user's business
 *   email:       "<email>",
 *   iat:         <timestamp>,
 *   exp:         <timestamp>
 * }
 *
 * @param {Request} request  Next.js App Router Request object
 * @returns {{ user_id: string, business_id: string, email: string }}
 */
export function requireAuth(request) {
  const authHeader = request.headers.get('authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.status = 401;
    throw err;
  }

  const token = authHeader.slice(7).trim();

  if (!JWT_SECRET) {
    const err = new Error('Server misconfiguration: JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }

  // Normalise field names — Operon may use `sub` or `user_id`
  const user_id = payload.user_id || payload.sub;
  const business_id = payload.business_id;

  if (!user_id) {
    const err = new Error('Token is missing user_id / sub claim');
    err.status = 401;
    throw err;
  }

  if (!business_id) {
    const err = new Error('Token is missing business_id claim');
    err.status = 403;
    throw err;
  }

  return { user_id, business_id, email: payload.email };
}

/**
 * Build a standardised JSON error response.
 * @param {string} message
 * @param {number} status  HTTP status code
 */
export function errorResponse(message, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

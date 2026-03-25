import { Pool } from 'pg';

// Module-level pool singleton — safe across Next.js API hot-reloads
// because Next.js caches module instances per process.
let pool;

function buildSslConfig() {
  const dbUrl = process.env.DATABASE_URL || '';

  // Explicitly disabled (e.g. local dev without SSL)
  if (dbUrl.includes('sslmode=disable')) {
    return false;
  }

  // Production: require a valid certificate
  if (process.env.NODE_ENV === 'production') {
    return { rejectUnauthorized: true };
  }

  // Non-production: accept self-signed certs (local / CI / staging)
  return { rejectUnauthorized: false };
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: buildSslConfig(),
    });
  }
  return pool;
}

/**
 * Run a single query against the pool.
 * @param {string} text   SQL query string with $1, $2 … placeholders
 * @param {any[]}  params Positional parameter values
 */
export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

/**
 * Acquire a client for multi-statement transactions.
 * Callers must call client.release() when done.
 */
export async function getClient() {
  return getPool().connect();
}

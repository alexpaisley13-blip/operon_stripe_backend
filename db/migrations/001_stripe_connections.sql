-- =============================================================================
-- Migration: 001_stripe_connections
-- Creates the stripe_connections table and adds the stripe_connected flag to
-- the businesses table.
--
-- Run once against your PostgreSQL database:
--   psql $DATABASE_URL -f db/migrations/001_stripe_connections.sql
-- =============================================================================

-- Enable the pgcrypto extension if not already enabled (needed for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- stripe_connections
-- Stores one row per connected Stripe account per Operon business.
-- A business can reconnect (or connect a different account) — old rows are
-- overwritten via an ON CONFLICT ... DO UPDATE upsert on stripe_account_id.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_connections (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID        NOT NULL,
    user_id              UUID        NOT NULL,

    -- Core Stripe identifiers
    stripe_account_id    TEXT        NOT NULL UNIQUE,
    stripe_account_email TEXT,
    stripe_account_type  TEXT,

    -- Account capability flags (refreshed on reconnect)
    details_submitted    BOOLEAN     DEFAULT FALSE,
    charges_enabled      BOOLEAN     DEFAULT FALSE,
    payouts_enabled      BOOLEAN     DEFAULT FALSE,

    -- Account locale info
    country              TEXT,
    default_currency     TEXT,

    -- Full account object from Stripe API (for future use / debugging)
    raw_account_json     JSONB,

    -- OAuth tokens
    access_token         TEXT,
    refresh_token        TEXT,
    scope                TEXT,

    -- Whether the connection was made in Stripe live mode
    livemode             BOOLEAN     DEFAULT FALSE,

    -- Timestamps
    connected_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast look-ups by business
CREATE INDEX IF NOT EXISTS idx_stripe_connections_business_id
    ON stripe_connections (business_id);

-- Index for look-ups by user
CREATE INDEX IF NOT EXISTS idx_stripe_connections_user_id
    ON stripe_connections (user_id);

-- -----------------------------------------------------------------------------
-- businesses table — add the stripe_connected convenience flag if it does not
-- already exist. This lets Operon quickly check connection status without
-- joining stripe_connections.
-- -----------------------------------------------------------------------------
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT FALSE;

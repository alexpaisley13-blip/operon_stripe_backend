# operon_stripe_backend

Standalone JavaScript-only Stripe Connect backend for Operon. Built with **Next.js App Router**, **PostgreSQL (pg)**, and the **Stripe Node SDK**. Runs on Vercel with zero TypeScript, no Prisma, and no MongoDB.

---

## File tree

```
.
├── .env.example
├── next.config.js
├── package.json
├── README.md
│
├── db/
│   └── migrations/
│       └── 001_stripe_connections.sql
│
├── lib/
│   ├── db.js        ← PostgreSQL pool (pg)
│   ├── auth.js      ← Operon JWT verification helper
│   └── stripe.js    ← Stripe SDK + OAuth helpers
│
└── app/
    └── api/
        └── stripe/
            ├── connect/
            │   └── route.js    ← GET  /api/stripe/connect
            ├── callback/
            │   └── route.js    ← GET  /api/stripe/callback
            ├── status/
            │   └── route.js    ← GET  /api/stripe/status
            └── disconnect/
                └── route.js    ← POST /api/stripe/disconnect
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in all values.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Secret key from the Stripe Dashboard (`sk_test_…` or `sk_live_…`) |
| `STRIPE_CLIENT_ID` | OAuth client ID from *Connect settings* in the Stripe Dashboard (`ca_…`) |
| `STRIPE_REDIRECT_URI` | Full URL of your `/api/stripe/callback` endpoint (must be registered in the Stripe Dashboard) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (optional, for future webhook handling) |
| `STRIPE_STATE_SECRET` | Long random string used to sign the OAuth state token (falls back to `STRIPE_SECRET_KEY`) |
| `JWT_SECRET` | The secret used to sign/verify Operon JWTs |
| `APP_URL` | Public URL of your Operon frontend, e.g. `https://app.operon.com` |

### How to get `STRIPE_SECRET_KEY`

1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com).
2. Click **Developers → API keys**.
3. Copy the **Secret key** (`sk_test_…` for test mode, `sk_live_…` for live mode).
4. Set it as `STRIPE_SECRET_KEY` in your `.env.local` / Vercel environment.

### How to get `STRIPE_CLIENT_ID`

1. In the Stripe Dashboard go to **Connect → Settings** (or [dashboard.stripe.com/settings/connect](https://dashboard.stripe.com/settings/connect)).
2. Under **Integration** you will see your **client\_id** (`ca_…`).
3. Set it as `STRIPE_CLIENT_ID`.

### How to set `STRIPE_REDIRECT_URI`

1. In the same **Connect → Settings** page, add your redirect URI under **OAuth settings → Redirects**.
2. For local development use `http://localhost:3000/api/stripe/callback`.
3. For production use `https://your-domain.com/api/stripe/callback`.
4. Set the same value as `STRIPE_REDIRECT_URI` in your environment.

---

## Database setup

Run the migration once to create the `stripe_connections` table and add the `stripe_connected` column to your `businesses` table:

```bash
psql $DATABASE_URL -f db/migrations/001_stripe_connections.sql
```

---

## How the connect flow works

```
User clicks "Connect Stripe"
        │
        ▼
GET /api/stripe/connect          ← requires Operon Bearer token
  • validates JWT
  • builds signed state token    (business_id + user_id + nonce + timestamp)
  • redirects browser → Stripe OAuth page
        │
        ▼
User authorises on Stripe
        │
        ▼
GET /api/stripe/callback?code=...&state=...
  • verifies state signature     (prevents CSRF)
  • exchanges code → access_token + stripe_user_id
  • retrieves full account from Stripe API
  • upserts stripe_connections row
  • sets businesses.stripe_connected = true
  • redirects → ${APP_URL}/settings/stripe?connected=true
```

---

## API reference

### `GET /api/stripe/connect`

**Auth:** `Authorization: Bearer <token>` required.

Starts the Stripe Connect OAuth flow. Returns a redirect to Stripe (or, if the `Accept: application/json` header is present, returns `{ success: true, url: "..." }` so the front end can handle navigation).

---

### `GET /api/stripe/callback`

**Auth:** Not required — Stripe sends the user here after authorisation.

Handles the OAuth redirect. Validates state, exchanges the code, saves the connection, and redirects the user to the Operon frontend.

---

### `GET /api/stripe/status`

**Auth:** `Authorization: Bearer <token>` required.

Returns the Stripe connection status for the authenticated business.

```jsonc
// Connected:
{ "success": true, "connected": true, "account": { "stripe_account_id": "acct_...", ... } }

// Not connected:
{ "success": true, "connected": false, "account": null }
```

---

### `POST /api/stripe/disconnect`

**Auth:** `Authorization: Bearer <token>` required.

Revokes the Stripe OAuth token, deletes the `stripe_connections` row, and sets `businesses.stripe_connected = false`.

```jsonc
{ "success": true, "message": "Stripe account disconnected" }
```

---

## Testing in Stripe test mode

1. Make sure `STRIPE_SECRET_KEY` starts with `sk_test_`.
2. Use a test Stripe account for the OAuth flow — go to [dashboard.stripe.com](https://dashboard.stripe.com) while in **Test mode**.
3. When prompted during the Connect flow, log in with your Stripe test account credentials.
4. After a successful test connection the database row will have `livemode = false`.

---

## Front-end usage

### Connect Stripe button

```jsx
// React example — calls the backend endpoint and follows the redirect
async function handleConnectStripe() {
  const res = await fetch('/api/stripe/connect', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${yourOperonJwt}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const { error } = await res.json();
    console.error('Connect failed:', error);
    return;
  }

  const { url } = await res.json();
  window.location.href = url; // redirect user to Stripe
}

// In your JSX:
<button onClick={handleConnectStripe}>Connect Stripe</button>
```

### Check Stripe status on page load

```js
const res = await fetch('/api/stripe/status', {
  headers: { 'Authorization': `Bearer ${yourOperonJwt}` },
});
const { connected, account } = await res.json();
```

### Disconnect Stripe

```js
await fetch('/api/stripe/disconnect', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${yourOperonJwt}` },
});
```
export default async function StripeSuccessPage({ searchParams }) {
  const params = await searchParams;
  const connected = params.connected;
  const account = params.account;
  const error = params.error;

  const isConnected = connected === 'true';
  const appUrl = process.env.APP_URL || '/';

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {isConnected ? (
        <>
          <h1 style={{ color: '#0a2540', marginBottom: '0.5rem' }}>
            Stripe Connected Successfully
          </h1>
          <p style={{ color: '#425466', marginBottom: '1.5rem' }}>
            Your Stripe account has been connected to Operon.
            {account && (
              <>
                {' '}
                Account ID: <strong>{account}</strong>
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <h1 style={{ color: '#c0392b', marginBottom: '0.5rem' }}>
            Stripe Connection Failed
          </h1>
          <p style={{ color: '#425466', marginBottom: '1.5rem' }}>
            {error
              ? `Error: ${error}`
              : 'Something went wrong while connecting your Stripe account.'}
          </p>
        </>
      )}

      <a
        href={appUrl}
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#635bff',
          color: '#fff',
          borderRadius: '6px',
          textDecoration: 'none',
          fontWeight: '600',
        }}
      >
        Return to Operon
      </a>
    </main>
  );
}

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Operon Stripe Backend</h1>
      <p>Welcome to the Stripe Connect integration API.</p>
      
      <h2>Quick Links</h2>
      <ul>
        <li><a href="/api/stripe/connect">Initiate Stripe Connect</a></li>
        <li><a href="/stripe/success">View Success Page</a></li>
      </ul>
      
      <h2>Environment Status</h2>
      <ul>
        <li>Database URL: {process.env.DATABASE_URL ? '✅ Configured' : '❌ Missing'}</li>
        <li>Stripe Secret Key: {process.env.STRIPE_SECRET_KEY ? '✅ Configured' : '❌ Missing'}</li>
        <li>Stripe Client ID: {process.env.STRIPE_CLIENT_ID ? '✅ Configured' : '❌ Missing'}</li>
        <li>JWT Secret: {process.env.JWT_SECRET ? '✅ Configured' : '��� Missing'}</li>
        <li>App URL: {process.env.APP_URL ? '✅ Configured' : '❌ Missing'}</li>
      </ul>
      
      <h2>Testing</h2>
      <p>To test the Stripe Connect flow, you'll need to:</p>
      <ol>
        <li>Generate a valid JWT token with business_id and user_id claims</li>
        <li>Call /api/stripe/connect with Authorization: Bearer [token]</li>
        <li>You'll be redirected to Stripe's authorization page</li>
      </ol>
    </div>
  );
}
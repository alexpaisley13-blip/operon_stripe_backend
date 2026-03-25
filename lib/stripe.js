// Validate STRIPE_SECRET_KEY at module initialization
if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required');
}
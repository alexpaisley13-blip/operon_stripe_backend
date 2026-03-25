const express = require('express');
const jwt = require('jsonwebtoken');
  
const router = express.Router();

// Temporary JWT generator for development testing
router.get('/generate-jwt', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).send('Access denied.');
    }

    const testUserId = 'test_user_id'; // Replace with logic to create test user ID
    const testBusinessId = 'test_business_id'; // Replace with logic to create test business ID
    const payload = { userId: testUserId, businessId: testBusinessId };

    // Sign the JWT
    const token = jwt.sign(payload, 'your_jwt_secret', { expiresIn: '1h' }); // Replace 'your_jwt_secret' with your secret

    // Redirect to the Stripe connect flow (replace with actual redirect logic)
    res.redirect(`https://connect.stripe.com/oauth/authorize?response_type=code&client_id=your_client_id&scope=read_write&state=${token}`);
});

module.exports = router;
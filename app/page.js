const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send(`<h1>App Status: Running</h1><a href='/test-stripe'>Test Stripe Connect Endpoint</a>`);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

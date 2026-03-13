const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.body || {};
  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Session not completed' });
    }

    const customer = await stripe.customers.retrieve(session.customer);
    const apiKey = customer.metadata?.service_api_key;

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found. Please wait a moment and try again.' });
    }

    res.json({ api_key: apiKey });
  } catch (err) {
    console.error('Verify session error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
};

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Hash an API key using SHA-256
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let customerId;

    // Try to get customer_id from request body
    if (req.body?.customer_id) {
      customerId = req.body.customer_id;
    } else {
      // Alternatively, look up by API key from Authorization header
      const authHeader = req.headers.authorization || '';
      const match = authHeader.match(/^Bearer\s+(dct_.+)$/);
      if (!match) {
        return res.status(401).json({ error: 'customer_id or API key is required' });
      }

      const apiKeyHash = hashApiKey(match[1]);
      const customers = await stripe.customers.search({
        query: `metadata["api_key_hash"]:"${apiKeyHash}"`,
      });

      if (customers.data.length === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      customerId = customers.data[0].id;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.SITE_URL}/`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    console.error('Manage subscription error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
};

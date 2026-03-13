const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Disable body parsing to get raw body for Stripe signature verification
module.exports.config = { api: { bodyParser: false } };

// In-memory idempotency set (cleared on serverless cold start, Stripe retries handle this)
const processedEvents = new Set();

const getRawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

// Generate a service API key with dct_ prefix
function generateApiKey() {
  return 'dct_' + crypto.randomBytes(32).toString('hex');
}

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

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Idempotency check
  if (processedEvents.has(event.id)) {
    return res.json({ received: true, duplicate: true });
  }
  processedEvents.add(event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;

        // Generate API key and store hash in customer metadata
        const apiKey = generateApiKey();
        const apiKeyHash = hashApiKey(apiKey);

        await stripe.customers.update(customerId, {
          metadata: {
            api_key_hash: apiKeyHash,
            service_api_key: apiKey,
          },
        });

        console.log('API key generated for customer:', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Clear API key hash from customer metadata
        await stripe.customers.update(customerId, {
          metadata: {
            api_key_hash: '',
            service_api_key: '',
          },
        });

        console.log('API key cleared for customer:', customerId);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({ received: true });
};

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');

// POST /api/payment/create-intent
// Creates a Stripe PaymentIntent and returns the clientSecret to the frontend.
router.post('/create-intent', protect, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // PKR is not supported by Stripe. We charge in USD cents (1 USD = smallest unit).
    // Amount arrives as PKR total; convert to USD for Stripe (1 USD ≈ 280 PKR).
    const PKR_TO_USD = 280;
    const usdCents = Math.max(Math.round((amount / PKR_TO_USD) * 100), 50); // Stripe minimum is $0.50

    const paymentIntent = await stripe.paymentIntents.create({
      amount: usdCents, // cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(req.user._id), pkrAmount: String(amount) },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe create-intent error:', err.message, err.type, err.code);
    res.status(500).json({ message: err.message || 'Failed to create payment intent' });
  }
});

// POST /api/payment/webhook
// Stripe sends events here. Use raw body (configured in app.js).
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    // Find order by paymentIntentId and mark as paid (fallback for missed confirmations)
    try {
      const order = await Order.findByPaymentIntentId(pi.id);
      if (order && !order.isPaid) {
        await Order.updateById(order._id, {
          isPaid: true,
          paidAt: new Date().toISOString(),
          paymentResult: {
            id: pi.id,
            status: pi.status,
            amount: pi.amount / 100,
            currency: 'usd',
          },
        });
      }
    } catch (e) {
      console.error('Webhook order update error:', e.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;

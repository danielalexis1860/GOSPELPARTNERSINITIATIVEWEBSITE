const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Donation = require('../models/Donation');
const { sendDonorReceipt, sendAdminNotification } = require('../utils/sendEmail');

const afterPayment = async (donation) => {
  try {
    await sendDonorReceipt(donation);
    await sendAdminNotification(donation);
    donation.receiptSent   = true;
    donation.adminNotified = true;
    await donation.save();
  } catch (err) {
    console.error('Webhook email error (non-fatal):', err.message);
  }
};

/* ── Stripe webhook (raw body required — mounted before express.json) ── */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent   = event.data.object;
      const donation = await Donation.findOneAndUpdate(
        { stripePaymentIntentId: intent.id },
        { status: 'completed', stripeChargeId: intent.latest_charge },
        { new: true }
      );
      if (donation && !donation.receiptSent) await afterPayment(donation);
      break;
    }
    case 'payment_intent.payment_failed': {
      await Donation.findOneAndUpdate(
        { stripePaymentIntentId: event.data.object.id },
        { status: 'failed' }
      );
      break;
    }
    case 'charge.refunded': {
      await Donation.findOneAndUpdate(
        { stripeChargeId: event.data.object.id },
        { status: 'refunded' }
      );
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

/* ── Flutterwave webhook ── */
router.post('/flutterwave', express.json(), async (req, res) => {
  const signature = req.headers['verif-hash'];
  // Flutterwave sends your secret key as the verif-hash header
  if (!signature || signature !== process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(401).json({ message: 'Unauthorised' });
  }

  const { event, data } = req.body;
  if (event === 'charge.completed' && data?.status === 'successful') {
    const donation = await Donation.findOneAndUpdate(
      { flutterwaveTxRef: data.tx_ref },
      { status: 'completed', flutterwaveTransactionId: String(data.id) },
      { new: true }
    );
    if (donation && !donation.receiptSent) await afterPayment(donation);
  }

  res.status(200).json({ status: 'ok' });
});

module.exports = router;

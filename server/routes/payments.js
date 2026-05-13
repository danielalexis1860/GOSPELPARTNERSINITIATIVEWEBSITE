const express  = require('express');
const router   = express.Router();
const stripe   = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios    = require('axios');
const { v4: uuidv4 } = require('uuid');
const Donation = require('../models/Donation');
const {
  sendDonorReceipt,
  sendAdminNotification,
  sendBankTransferInstructions,
  bankDetails,
} = require('../utils/sendEmail');

/* ── helpers ─────────────────────────────────────────────────────── */
const afterPayment = async (donation) => {
  try {
    await sendDonorReceipt(donation);
    await sendAdminNotification(donation);
    donation.receiptSent   = true;
    donation.adminNotified = true;
    await donation.save();
  } catch (emailErr) {
    console.error('Email send failed (non-fatal):', emailErr.message);
  }
};

/* ══════════════════════════════════════════════════════════════════
   STRIPE
══════════════════════════════════════════════════════════════════ */

// Step 1 — create intent, return clientSecret to frontend
router.post('/stripe/create-intent', async (req, res) => {
  try {
    const {
      amount, currency = 'usd',
      donorName, donorEmail, donorPhone,
      program = 'general', message, isAnonymous = false,
    } = req.body;

    if (!donorName || !donorEmail) return res.status(400).json({ success: false, message: 'Name and email required' });
    if (!amount || parseFloat(amount) < 1) return res.status(400).json({ success: false, message: 'Amount must be at least 1' });

    const cents = Math.round(parseFloat(amount) * 100);
    const intent = await stripe.paymentIntents.create({
      amount:        cents,
      currency:      currency.toLowerCase(),
      receipt_email: donorEmail,
      metadata:      { donorName, program },
    });

    const donation = await Donation.create({
      donorName, donorEmail, donorPhone,
      donationType: 'money',
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      program, message,
      isAnonymous,
      gateway: 'stripe',
      status:  'pending',
      stripePaymentIntentId: intent.id,
    });

    res.json({ success: true, clientSecret: intent.client_secret, donationId: donation._id });
  } catch (err) {
    console.error('Stripe intent error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Step 2 — frontend confirms; call this to mark completed + send emails
router.post('/stripe/confirm', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ success: false, message: 'paymentIntentId required' });

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: `Payment status: ${intent.status}` });
    }

    const donation = await Donation.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'completed', stripeChargeId: intent.latest_charge },
      { new: true }
    );
    if (donation && !donation.receiptSent) await afterPayment(donation);
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   PAYPAL
══════════════════════════════════════════════════════════════════ */

const getPayPalToken = async () => {
  const r = await axios.post(
    `${process.env.PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth:    { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_CLIENT_SECRET },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return r.data.access_token;
};

router.post('/paypal/create-order', async (req, res) => {
  try {
    const {
      amount, currency = 'USD',
      donorName, donorEmail, donorPhone,
      program = 'general', message, isAnonymous = false,
    } = req.body;

    if (!donorName || !donorEmail) return res.status(400).json({ success: false, message: 'Name and email required' });

    const token = await getPayPalToken();
    const ppRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: currency.toUpperCase(), value: parseFloat(amount).toFixed(2) },
          description: `Gospel Partners — ${program} Donation`,
        }],
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const donation = await Donation.create({
      donorName, donorEmail, donorPhone,
      donationType: 'money',
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      program, message, isAnonymous,
      gateway: 'paypal',
      status:  'pending',
      paypalOrderId: ppRes.data.id,
    });

    res.json({ success: true, orderId: ppRes.data.id, donationId: donation._id });
  } catch (err) {
    console.error('PayPal create:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'PayPal order creation failed' });
  }
});

router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    const token = await getPayPalToken();
    const ppRes = await axios.post(
      `${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    if (ppRes.data.status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'PayPal capture not completed' });
    }

    const captureId = ppRes.data.purchase_units[0].payments.captures[0].id;
    const donation  = await Donation.findOneAndUpdate(
      { paypalOrderId: orderId },
      { status: 'completed', paypalCaptureId: captureId },
      { new: true }
    );
    if (donation && !donation.receiptSent) await afterPayment(donation);
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   FLUTTERWAVE
══════════════════════════════════════════════════════════════════ */

router.post('/flutterwave/initiate', async (req, res) => {
  try {
    const {
      amount, currency = 'NGN',
      donorName, donorEmail, donorPhone,
      program = 'general', message, isAnonymous = false,
    } = req.body;

    if (!donorName || !donorEmail) return res.status(400).json({ success: false, message: 'Name and email required' });

    const txRef = `GPI-FLW-${uuidv4()}`;

    const donation = await Donation.create({
      donorName, donorEmail, donorPhone,
      donationType: 'money',
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      program, message, isAnonymous,
      gateway: 'flutterwave',
      status:  'pending',
      flutterwaveTxRef: txRef,
    });

    // Return the config the client-side Flutterwave JS SDK needs
    res.json({
      success: true,
      donationId: donation._id,
      flwConfig: {
        public_key:      process.env.FLUTTERWAVE_PUBLIC_KEY,
        tx_ref:          txRef,
        amount:          parseFloat(amount),
        currency:        currency.toUpperCase(),
        payment_options: 'card,mobilemoneyghana,ussd,banktransfer',
        redirect_url:    `${process.env.CLIENT_URL}/payment-success.html`,
        customer: {
          email:       donorEmail,
          name:        donorName,
          phonenumber: donorPhone || '',
        },
        customizations: {
          title:       'Gospel Partners Initiative',
          description: `Donation to ${program.replace(/-/g, ' ')} program`,
          logo:        `${process.env.CLIENT_URL}/assets/images/logo_redefined.jpeg`,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/flutterwave/verify', async (req, res) => {
  try {
    const { transactionId, txRef } = req.body;

    const flwRes = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
    );
    const data = flwRes.data.data;

    if (data.status !== 'successful' || data.tx_ref !== txRef) {
      return res.status(400).json({ success: false, message: 'Flutterwave verification failed' });
    }

    const donation = await Donation.findOneAndUpdate(
      { flutterwaveTxRef: txRef },
      { status: 'completed', flutterwaveTransactionId: String(transactionId) },
      { new: true }
    );
    if (donation && !donation.receiptSent) await afterPayment(donation);
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   BANK TRANSFER
══════════════════════════════════════════════════════════════════ */

router.post('/bank-transfer/initiate', async (req, res) => {
  try {
    const {
      amount, currency = 'USD',
      donorName, donorEmail, donorPhone,
      program = 'general', message, isAnonymous = false,
    } = req.body;

    if (!donorName || !donorEmail) return res.status(400).json({ success: false, message: 'Name and email required' });

    const ref = `GPI-BT-${Date.now().toString(36).toUpperCase()}`;

    const donation = await Donation.create({
      donorName, donorEmail, donorPhone,
      donationType: 'bank_transfer',
      amount:   parseFloat(amount) || 0,
      currency: currency.toUpperCase(),
      program, message, isAnonymous,
      gateway: 'bank_transfer',
      status:  'pending',
      bankTransferReference: ref,
    });

    // Email donor the bank instructions
    await sendBankTransferInstructions(donation);
    // Notify admin
    await sendAdminNotification(donation);
    donation.adminNotified = true;
    await donation.save();

    res.json({
      success:  true,
      donationId: donation._id,
      reference:  ref,
      bankDetails: bankDetails(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   ITEMS DONATION
══════════════════════════════════════════════════════════════════ */

router.post('/items', async (req, res) => {
  try {
    const { donorName, donorEmail, donorPhone, itemsDescription, itemsPickupAddress, program, message } = req.body;

    if (!donorName || !donorEmail || !itemsDescription) {
      return res.status(400).json({ success: false, message: 'Name, email, and item description required' });
    }

    const donation = await Donation.create({
      donorName, donorEmail, donorPhone,
      donationType: 'items',
      amount: 0,
      program:            program || 'mobile-charity-shop',
      itemsDescription,
      itemsPickupAddress,
      message,
      gateway: 'manual',
      status:  'pending',
    });

    await afterPayment(donation);
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    // ── Donor ─────────────────────────────────────────────────────
    donorName:  { type: String, required: true, trim: true },
    donorEmail: { type: String, required: true, lowercase: true, trim: true },
    donorPhone: { type: String, trim: true },
    country:    { type: String, default: 'Unknown' },
    isAnonymous:{ type: Boolean, default: false },

    // ── Donation ───────────────────────────────────────────────────
    donationType: {
      type: String,
      enum: ['money', 'items', 'bank_transfer'],
      required: true,
    },
    amount:   { type: Number, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    program: {
      type: String,
      enum: ['general', 'educate-a-child', 'mobile-charity-shop', 'love-concert'],
      default: 'general',
    },
    message: { type: String, trim: true, maxlength: 500 },

    // ── Payment Gateway ────────────────────────────────────────────
    gateway: {
      type: String,
      enum: ['stripe', 'paypal', 'flutterwave', 'bank_transfer', 'manual'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },

    // Gateway transaction IDs
    stripePaymentIntentId: String,
    stripeChargeId:        String,
    paypalOrderId:         String,
    paypalCaptureId:       String,
    flutterwaveTxRef:      String,
    flutterwaveTransactionId: String,

    // Bank transfer
    bankTransferReference:    String,
    bankTransferConfirmedAt:  Date,

    // Items donation
    itemsDescription:   String,
    itemsPickupAddress: String,

    // ── Admin ──────────────────────────────────────────────────────
    receiptSent:    { type: Boolean, default: false },
    adminNotified:  { type: Boolean, default: false },
    receiptNumber:  { type: String, unique: true, sparse: true },
    adminNotes:     String,
  },
  { timestamps: true }
);

// Auto receipt number
donationSchema.pre('save', function (next) {
  if (this.isNew && !this.receiptNumber) {
    const year = new Date().getFullYear();
    const rand = String(Math.floor(Math.random() * 900000) + 100000);
    this.receiptNumber = `GPI-${year}-${rand}`;
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);

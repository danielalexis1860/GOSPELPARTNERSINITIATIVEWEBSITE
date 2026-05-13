require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const connectDB   = require('./config/db');
const Admin       = require('./models/Admin');

/* ── Import routes ─────────────────────────────────────────────── */
// Webhook MUST be imported before body parsers (needs raw body)
const webhookRoutes = require('./routes/webhooks');
const paymentRoutes = require('./routes/payments');
const adminRoutes   = require('./routes/admin');

const app = express();

/* ── Database ──────────────────────────────────────────────────── */
connectDB();

/* ── Security headers ──────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false }));

/* ── CORS ──────────────────────────────────────────────────────── */
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'null', // file:// opened locally
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

/* ── Rate limiting ──────────────────────────────────────────────── */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders:   false,
});
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many payment requests — please wait.' },
});

app.use(globalLimiter);

/* ── Stripe webhook MUST be mounted BEFORE express.json() ────────── */
app.use('/api/webhooks', webhookRoutes);

/* ── Body parsing ──────────────────────────────────────────────── */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Logging ────────────────────────────────────────────────────── */
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

/* ── API routes ─────────────────────────────────────────────────── */
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/admin',    adminRoutes);

/* ── Config endpoints (safe public values) ──────────────────────── */
app.get('/api/config/stripe',       (_, res) => res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY }));
app.get('/api/config/paypal',       (_, res) => res.json({ clientId: process.env.PAYPAL_CLIENT_ID }));
app.get('/api/config/flutterwave',  (_, res) => res.json({ publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY }));
app.get('/api/config/bank',         (_, res) => res.json({
  bankName:      process.env.BANK_NAME,
  accountName:   process.env.BANK_ACCOUNT_NAME,
  accountNumber: process.env.BANK_ACCOUNT_NUMBER,
  sortCode:      process.env.BANK_SORT_CODE,
  swiftCode:     process.env.BANK_SWIFT_CODE,
  iban:          process.env.BANK_IBAN,
}));

/* ── Health check ───────────────────────────────────────────────── */
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date() }));

/* ── Serve client in production ─────────────────────────────────── */
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (_, res) => res.sendFile(path.resolve(__dirname, '../client/index.html')));
}

/* ── Global error handler ───────────────────────────────────────── */
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Server error',
  });
});

/* ── Start ──────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`\n🚀  Server: http://localhost:${PORT}  [${process.env.NODE_ENV}]`);

  // Seed super admin on first run
  try {
    if ((await Admin.countDocuments()) === 0) {
      await Admin.create({
        name:     process.env.ADMIN_NAME     || 'Super Admin',
        email:    process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role:     'super_admin',
      });
      console.log(`✅  Super admin created: ${process.env.ADMIN_EMAIL}`);
      console.log(`⚠️   Change the default password after first login!\n`);
    }
  } catch (e) {
    console.error('Admin seed error:', e.message);
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
module.exports = app;

const nodemailer = require('nodemailer');

/* ── Transporter ─────────────────────────────────────────────────── */
const transporter = () =>
  nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });

/* ── Shared CSS ──────────────────────────────────────────────────── */
const BASE_STYLE = `
  body{margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .hdr{background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:36px 32px;text-align:center;color:#fff}
  .hdr h1{margin:0 0 6px;font-size:22px;font-weight:700}
  .hdr p{margin:0;opacity:.85;font-size:14px}
  .body{padding:32px}
  .amount{font-size:2.4rem;font-weight:800;color:#1e3a8a;text-align:center;margin:20px 0}
  .box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:18px;margin:18px 0}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  .row:last-child{border-bottom:none;font-weight:700}
  .badge{display:inline-block;background:#10b981;color:#fff;padding:3px 14px;border-radius:20px;font-size:12px;font-weight:700}
  .btn{display:inline-block;background:#fbbf24;color:#0f172a;padding:12px 28px;border-radius:50px;font-weight:700;text-decoration:none;font-size:15px;margin-top:18px}
  .ftr{background:#0f172a;color:#64748b;text-align:center;padding:20px;font-size:12px}
  .ftr a{color:#94a3b8}
`;

/* ── Template helpers ────────────────────────────────────────────── */
const date   = d  => new Date(d || Date.now()).toLocaleDateString('en-US', { dateStyle: 'long' });
const fmtAmt = d  => d.amount > 0 ? `${d.currency} ${parseFloat(d.amount).toFixed(2)}` : 'Items Donation';
const fmtGw  = gw => gw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const fmtPrg = p  => p.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

/* ── 1. Donor receipt ─────────────────────────────────────────────── */
const donorReceiptHtml = d => `<!DOCTYPE html><html><head><style>${BASE_STYLE}</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>✝ Gospel Partners Initiative</h1><p>Donation Receipt — Thank You!</p></div>
  <div class="body">
    <p>Dear ${d.isAnonymous ? 'Friend' : d.donorName},</p>
    <p>Your generous donation has been received and recorded. May God bless you abundantly!</p>
    ${d.amount > 0 ? `<div class="amount">${fmtAmt(d)}</div>` : '<p><strong>✅ Items Donation Received</strong></p>'}
    <div class="box">
      <div class="row"><span>Receipt #</span><span>${d.receiptNumber}</span></div>
      <div class="row"><span>Date</span><span>${date(d.createdAt)}</span></div>
      <div class="row"><span>Payment method</span><span>${fmtGw(d.gateway)}</span></div>
      <div class="row"><span>Program</span><span>${fmtPrg(d.program)}</span></div>
      <div class="row"><span>Status</span><span><span class="badge">✔ ${d.status.toUpperCase()}</span></span></div>
    </div>
    ${d.message ? `<blockquote style="border-left:4px solid #fbbf24;margin:16px 0;padding:8px 16px;color:#64748b;font-style:italic">"${d.message}"</blockquote>` : ''}
    <p>Your contribution directly supports widows, orphans, and street children in our community.</p>
    <div style="text-align:center"><a class="btn" href="${process.env.CLIENT_URL}/#programs">See Your Impact ❤️</a></div>
    <p style="margin-top:28px">With gratitude,<br><strong>The Gospel Partners Initiative Team</strong></p>
  </div>
  <div class="ftr"><p>The Gospel Partners Initiative | 123 Care Avenue, Hope City</p><p>This receipt may be used for tax purposes where applicable.</p></div>
</div></body></html>`;

/* ── 2. Admin alert ───────────────────────────────────────────────── */
const adminAlertHtml = d => `<!DOCTYPE html><html><head><style>${BASE_STYLE}</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>💰 New Donation Alert</h1><p>${fmtGw(d.gateway)} — ${fmtAmt(d)}</p></div>
  <div class="body">
    <span class="badge" style="background:${d.status==='completed'?'#10b981':'#f59e0b'}">${d.status.toUpperCase()}</span>
    <div class="box" style="margin-top:16px">
      <div class="row"><span>Donor</span><span>${d.isAnonymous ? 'Anonymous' : d.donorName}</span></div>
      <div class="row"><span>Email</span><span>${d.donorEmail}</span></div>
      ${d.donorPhone ? `<div class="row"><span>Phone</span><span>${d.donorPhone}</span></div>` : ''}
      <div class="row"><span>Amount</span><span>${fmtAmt(d)}</span></div>
      <div class="row"><span>Gateway</span><span>${fmtGw(d.gateway)}</span></div>
      <div class="row"><span>Program</span><span>${fmtPrg(d.program)}</span></div>
      <div class="row"><span>Receipt #</span><span>${d.receiptNumber}</span></div>
      <div class="row"><span>Date &amp; time</span><span>${new Date().toLocaleString()}</span></div>
      ${d.message ? `<div class="row"><span>Message</span><span>${d.message}</span></div>` : ''}
      ${d.bankTransferReference ? `<div class="row"><span>Transfer ref</span><span><strong>${d.bankTransferReference}</strong></span></div>` : ''}
      ${d.itemsDescription ? `<div class="row"><span>Items</span><span>${d.itemsDescription}</span></div>` : ''}
    </div>
    ${d.gateway === 'bank_transfer' ? `<p style="color:#f59e0b;font-weight:600">⚠️ This is a bank transfer — confirm it in the admin dashboard once funds arrive.</p>` : ''}
    <div style="text-align:center"><a class="btn" href="${process.env.CLIENT_URL}/admin.html">Open Admin Dashboard</a></div>
  </div>
  <div class="ftr"><p>Gospel Partners Initiative — Admin Notification</p></div>
</div></body></html>`;

/* ── 3. Bank transfer instructions ───────────────────────────────── */
const bankInstructionsHtml = (d, bank) => `<!DOCTYPE html><html><head><style>${BASE_STYLE}
.brow{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #fde68a;font-size:14px}
.brow:last-child{border-bottom:none}
.ref{font-size:1.4rem;font-weight:800;color:#1e3a8a;background:#dbeafe;padding:12px 24px;border-radius:8px;text-align:center;letter-spacing:1px;margin:12px 0}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>✝ Gospel Partners Initiative</h1><p>Bank Transfer Instructions</p></div>
  <div class="body">
    <p>Dear ${d.donorName},</p>
    <p>Thank you! Please transfer <strong>${fmtAmt(d)}</strong> using the details below:</p>
    <div class="box" style="background:#fef3c7;border-color:#fbbf24">
      <div class="brow"><span><strong>Bank name</strong></span><span>${bank.bankName}</span></div>
      <div class="brow"><span><strong>Account name</strong></span><span>${bank.accountName}</span></div>
      <div class="brow"><span><strong>Account number</strong></span><span>${bank.accountNumber}</span></div>
      <div class="brow"><span><strong>Sort code</strong></span><span>${bank.sortCode}</span></div>
      <div class="brow"><span><strong>SWIFT / BIC</strong></span><span>${bank.swiftCode}</span></div>
      <div class="brow"><span><strong>IBAN</strong></span><span>${bank.iban}</span></div>
    </div>
    <p><strong>⚠️ Use this reference number when making your transfer:</strong></p>
    <div class="ref">${d.bankTransferReference}</div>
    <p>Once your payment clears (typically 1–3 business days) we will send your official receipt. To speed this up, you can reply with your transfer confirmation screenshot.</p>
    <p style="margin-top:24px">God bless you,<br><strong>The Gospel Partners Initiative Team</strong></p>
  </div>
  <div class="ftr"><p>hello@gospelpartners.org | 123 Care Avenue, Hope City</p></div>
</div></body></html>`;

/* ── Public send functions ────────────────────────────────────────── */
const bankDetails = () => ({
  bankName:      process.env.BANK_NAME,
  accountName:   process.env.BANK_ACCOUNT_NAME,
  accountNumber: process.env.BANK_ACCOUNT_NUMBER,
  sortCode:      process.env.BANK_SORT_CODE,
  swiftCode:     process.env.BANK_SWIFT_CODE,
  iban:          process.env.BANK_IBAN,
});

const sendDonorReceipt = async (donation) => {
  await transporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      donation.donorEmail,
    subject: `✅ Donation Receipt #${donation.receiptNumber} — Gospel Partners`,
    html:    donorReceiptHtml(donation),
  });
};

const sendAdminNotification = async (donation) => {
  await transporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.ADMIN_NOTIFY_EMAIL,
    subject: `💰 New ${fmtGw(donation.gateway)} Donation — ${fmtAmt(donation)}`,
    html:    adminAlertHtml(donation),
  });
};

const sendBankTransferInstructions = async (donation) => {
  await transporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      donation.donorEmail,
    subject: `Bank Transfer Instructions — Gospel Partners Initiative`,
    html:    bankInstructionsHtml(donation, bankDetails()),
  });
};

module.exports = { sendDonorReceipt, sendAdminNotification, sendBankTransferInstructions, bankDetails };

/* ================================================================
   THE GOSPEL PARTNERS INITIATIVE — script.js
   Handles: nav, animations, donation form, all payment gateways,
            bank transfer modal, toast notifications, success modal.
   ================================================================ */

'use strict';

/* ── Change this to your deployed server URL in production ─────── */
const API_BASE = 'http://localhost:5000/api';

/* ═══════════════════════════════════════════════════════════════
   DOM READY
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initFooterYear();
  initMobileNav();
  initScrollAnimations();
  initNavbarScroll();
  initAmountButtons();
  initDonationTypeRadios();
  initGatewayTabs();
  initDonationForm();
  loadBankDetails();
});

/* ═══════════════════════════════════════════════════════════════
   FOOTER YEAR
═══════════════════════════════════════════════════════════════ */
function initFooterYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE NAVIGATION
═══════════════════════════════════════════════════════════════ */
function initMobileNav() {
  const toggle   = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (!toggle || !navLinks) return;

  toggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('active');
    const icon   = toggle.querySelector('i');
    icon.classList.toggle('fa-bars',  !isOpen);
    icon.classList.toggle('fa-xmark',  isOpen);
    toggle.setAttribute('aria-expanded', isOpen);
  });

  /* Close on any link click */
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      const icon = toggle.querySelector('i');
      icon.classList.add('fa-bars');
      icon.classList.remove('fa-xmark');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* Close when clicking outside */
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !toggle.contains(e.target)) {
      navLinks.classList.remove('active');
      const icon = toggle.querySelector('i');
      icon.classList.add('fa-bars');
      icon.classList.remove('fa-xmark');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   INTERSECTION OBSERVER ANIMATIONS
═══════════════════════════════════════════════════════════════ */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

/* ═══════════════════════════════════════════════════════════════
   NAVBAR SCROLL EFFECT
═══════════════════════════════════════════════════════════════ */
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
      navbar.style.padding   = '0.5rem 0';
    } else {
      navbar.style.boxShadow = '0 1px 2px 0 rgba(0,0,0,0.05)';
      navbar.style.padding   = '1rem 0';
    }
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════
   AMOUNT PRESET BUTTONS
═══════════════════════════════════════════════════════════════ */
function initAmountButtons() {
  const amountBtns    = document.querySelectorAll('.amount-btn');
  const customInput   = document.getElementById('customAmount');

  amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      amountBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (customInput) customInput.value = '';
    });
  });

  if (customInput) {
    customInput.addEventListener('input', () => {
      amountBtns.forEach(b => b.classList.remove('active'));
    });
  }
}

function getSelectedAmount() {
  const custom = document.getElementById('customAmount');
  if (custom && custom.value && parseFloat(custom.value) > 0) {
    return parseFloat(custom.value);
  }
  const active = document.querySelector('.amount-btn.active');
  return active ? parseFloat(active.dataset.amount) : 0;
}

/* ═══════════════════════════════════════════════════════════════
   DONATION TYPE RADIOS (money / bank_transfer / items)
═══════════════════════════════════════════════════════════════ */
function initDonationTypeRadios() {
  const radios = document.querySelectorAll('input[name="donationType"]');
  radios.forEach(r => r.addEventListener('change', () => switchDonationType(r.value)));
}

function switchDonationType(type) {
  const moneyFields   = document.getElementById('moneyFields');
  const itemsFields   = document.getElementById('itemsFields');
  const gatewaySection = document.getElementById('gatewaySection');

  if (type === 'items') {
    moneyFields.style.display    = 'none';
    itemsFields.style.display    = 'block';
  } else if (type === 'bank_transfer') {
    moneyFields.style.display    = 'block';
    itemsFields.style.display    = 'none';
    /* Hide gateway tabs — bank transfer is handled separately */
    if (gatewaySection) gatewaySection.style.display = 'none';
  } else {
    /* money */
    moneyFields.style.display    = 'block';
    itemsFields.style.display    = 'none';
    if (gatewaySection) gatewaySection.style.display = 'block';
  }
}

/* ═══════════════════════════════════════════════════════════════
   GATEWAY TAB BUTTONS
═══════════════════════════════════════════════════════════════ */
function initGatewayTabs() {
  const btns = document.querySelectorAll('.gateway-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function getActiveGateway() {
  const active = document.querySelector('.gateway-btn.active');
  return active ? active.dataset.gateway : 'stripe';
}

/* ═══════════════════════════════════════════════════════════════
   LOAD BANK DETAILS FROM API
═══════════════════════════════════════════════════════════════ */
async function loadBankDetails() {
  const panel = document.getElementById('bankDetailsPanel');
  if (!panel) return;

  try {
    const res  = await fetch(`${API_BASE}/config/bank`);
    const data = await res.json();
    renderBankDetails(data, panel);
  } catch {
    panel.innerHTML = `
      <div class="bank-detail-row">
        <span>Could not load bank details.</span>
        <strong>Please contact us directly.</strong>
      </div>`;
  }
}

function renderBankDetails(details, container) {
  const rows = [
    ['Bank Name',       details.bankName],
    ['Account Name',    details.accountName],
    ['Account Number',  details.accountNumber],
    ['Sort Code',       details.sortCode],
    ['SWIFT / BIC',     details.swiftCode],
    ['IBAN',            details.iban],
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="bank-detail-row">
      <span>${label}</span>
      <strong>${value || '—'}</strong>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════════════════════
   DONATION FORM — MAIN SUBMIT HANDLER
═══════════════════════════════════════════════════════════════ */
function initDonationForm() {
  const form = document.getElementById('donateForm');
  if (!form) return;
  form.addEventListener('submit', handleDonationSubmit);
}

async function handleDonationSubmit(e) {
  e.preventDefault();

  const submitBtn  = document.getElementById('submitDonationBtn');
  const typeRadio  = document.querySelector('input[name="donationType"]:checked');
  const donationType = typeRadio ? typeRadio.value : 'money';

  /* Collect common donor fields */
  const donorName  = document.getElementById('donorName')?.value.trim();
  const donorEmail = document.getElementById('donorEmail')?.value.trim();
  const donorPhone = document.getElementById('donorPhone')?.value.trim();
  const program    = document.getElementById('program')?.value || 'general';
  const message    = document.getElementById('message')?.value.trim();
  const isAnonymous = document.getElementById('isAnonymous')?.checked || false;
  const currency   = document.getElementById('currency')?.value || 'USD';

  /* Validation */
  if (!donorName)  { showToast('error', 'Please enter your full name.'); return; }
  if (!donorEmail || !isValidEmail(donorEmail)) { showToast('error', 'Please enter a valid email address.'); return; }

  /* ── Items donation ── */
  if (donationType === 'items') {
    const itemsDescription  = document.getElementById('itemsDescription')?.value.trim();
    const itemsPickupAddress = document.getElementById('itemsPickupAddress')?.value.trim();
    if (!itemsDescription) { showToast('error', 'Please describe the items you wish to donate.'); return; }
    setButtonLoading(submitBtn, true);
    try {
      await submitItemsDonation({ donorName, donorEmail, donorPhone, itemsDescription, itemsPickupAddress, program, message });
    } finally {
      setButtonLoading(submitBtn, false);
    }
    return;
  }

  /* ── Money / bank transfer — need amount ── */
  const amount = getSelectedAmount();
  if (!amount || amount < 1) { showToast('error', 'Please select or enter a donation amount (minimum 1).'); return; }

  /* ── Bank transfer ── */
  if (donationType === 'bank_transfer') {
    setButtonLoading(submitBtn, true);
    try {
      await submitBankTransfer({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous });
    } finally {
      setButtonLoading(submitBtn, false);
    }
    return;
  }

  /* ── Online payment (Stripe / PayPal / Flutterwave) ── */
  const gateway = getActiveGateway();
  setButtonLoading(submitBtn, true);
  try {
    if      (gateway === 'stripe')       await submitStripe({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous });
    else if (gateway === 'paypal')       await submitPayPal({ donorName, donorEmail, amount, currency, program, message, isAnonymous });
    else if (gateway === 'flutterwave') await submitFlutterwave({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous });
    else if (gateway === 'bank_transfer') await submitBankTransfer({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous });
    else { showToast('error', 'Please select a payment method.'); }
  } catch (err) {
    console.error('Payment error:', err);
    showToast('error', err.message || 'Something went wrong. Please try again.');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/* ═══════════════════════════════════════════════════════════════
   STRIPE
═══════════════════════════════════════════════════════════════ */
async function submitStripe({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous }) {
  showLoading('Creating secure payment…');

  /* 1. Create Payment Intent on backend */
  const res = await apiPost('/payments/stripe/create-intent', {
    donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous,
  });
  if (!res.success) { hideLoading(); throw new Error(res.message); }

  /* 2. Load Stripe.js if not already loaded */
  if (!window.Stripe) {
    await loadScript('https://js.stripe.com/v3/');
  }

  /* 3. Get publishable key */
  const cfgRes = await fetch(`${API_BASE}/config/stripe`);
  const cfg    = await cfgRes.json();
  const stripe = Stripe(cfg.publishableKey);

  /* 4. Create card element and mount it into a temporary container */
  hideLoading();
  const elements = stripe.elements();
  const card     = elements.create('card', {
    style: {
      base: {
        fontFamily:  'Inter, sans-serif',
        fontSize:    '16px',
        color:       '#334155',
        '::placeholder': { color: '#94a3b8' },
      },
    },
  });

  /* Show Stripe card modal */
  showStripeCardModal(card, stripe, res.clientSecret, res.donationId, { donorName, donorEmail, amount, currency });
}

function showStripeCardModal(card, stripe, clientSecret, donationId, { donorName, donorEmail, amount, currency }) {
  const overlay = createOverlay();
  overlay.innerHTML = `
    <div class="gpi-modal" style="max-width:440px;">
      <button class="modal-close-x" id="stripeModalClose" aria-label="Close">&times;</button>
      <div class="modal-emoji">💳</div>
      <h2>Enter Card Details</h2>
      <p>Securely processed by Stripe</p>
      <div class="modal-amount">${currency} ${parseFloat(amount).toFixed(2)}</div>
      <div id="stripe-card-element" style="border:1.5px solid #e2e8f0;border-radius:8px;padding:0.85rem 1rem;margin:1rem 0;background:#fff;"></div>
      <div id="stripe-card-errors" style="color:#ef4444;font-size:0.85rem;min-height:1.2rem;margin-bottom:0.5rem;"></div>
      <button class="modal-btn" id="stripePayBtn">
        <i class="fa-solid fa-lock"></i> Pay ${currency} ${parseFloat(amount).toFixed(2)}
      </button>
      <p style="font-size:0.75rem;color:#94a3b8;margin-top:1rem;">
        <i class="fa-solid fa-shield-halved"></i> 256-bit SSL encryption via Stripe
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  card.mount('#stripe-card-element');

  card.addEventListener('change', (event) => {
    const errEl = document.getElementById('stripe-card-errors');
    if (errEl) errEl.textContent = event.error ? event.error.message : '';
  });

  document.getElementById('stripeModalClose').addEventListener('click', () => {
    overlay.remove();
  });

  document.getElementById('stripePayBtn').addEventListener('click', async () => {
    const payBtn = document.getElementById('stripePayBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
        billing_details: { name: donorName, email: donorEmail },
      },
    });

    if (error) {
      const errEl = document.getElementById('stripe-card-errors');
      if (errEl) errEl.textContent = error.message;
      payBtn.disabled = false;
      payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay ${currency} ${parseFloat(amount).toFixed(2)}`;
      return;
    }

    /* Payment succeeded — confirm on backend to trigger emails */
    overlay.remove();
    showLoading('Confirming your payment…');
    try {
      await apiPost('/payments/stripe/confirm', { paymentIntentId: paymentIntent.id });
    } catch { /* non-fatal — webhook will catch it */ }
    hideLoading();
    resetForm();
    showSuccessModal({ donorName, amount, currency, gateway: 'Card (Stripe)' });
  });
}

/* ═══════════════════════════════════════════════════════════════
   PAYPAL
═══════════════════════════════════════════════════════════════ */
async function submitPayPal({ donorName, donorEmail, amount, currency, program, message, isAnonymous }) {
  showLoading('Creating PayPal order…');

  const res = await apiPost('/payments/paypal/create-order', {
    donorName, donorEmail, amount, currency, program, message, isAnonymous,
  });
  hideLoading();
  if (!res.success) throw new Error(res.message);

  /* Load PayPal JS SDK with the correct client ID */
  const cfgRes  = await fetch(`${API_BASE}/config/paypal`);
  const cfg     = await cfgRes.json();

  if (!window.paypal) {
    await loadScript(`https://www.paypal.com/sdk/js?client-id=${cfg.clientId}&currency=${currency}`);
  }

  /* Render PayPal buttons in an overlay */
  const overlay = createOverlay();
  overlay.innerHTML = `
    <div class="gpi-modal" style="max-width:440px;">
      <button class="modal-close-x" id="ppModalClose" aria-label="Close">&times;</button>
      <div class="modal-emoji">
        <i class="fa-brands fa-paypal" style="color:#003087;font-size:2.5rem;"></i>
      </div>
      <h2>Pay with PayPal</h2>
      <div class="modal-amount">${currency} ${parseFloat(amount).toFixed(2)}</div>
      <div id="paypal-button-container" style="margin-top:1rem;"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('ppModalClose').addEventListener('click', () => overlay.remove());

  window.paypal.Buttons({
    createOrder: () => res.orderId,
    onApprove: async (data) => {
      overlay.remove();
      showLoading('Capturing PayPal payment…');
      const capture = await apiPost('/payments/paypal/capture-order', { orderId: data.orderID });
      hideLoading();
      if (!capture.success) { showToast('error', 'PayPal capture failed. Please contact us.'); return; }
      resetForm();
      showSuccessModal({ donorName, amount, currency, gateway: 'PayPal' });
    },
    onError: (err) => {
      overlay.remove();
      showToast('error', 'PayPal payment failed. Please try again.');
      console.error('PayPal error:', err);
    },
    onCancel: () => {
      overlay.remove();
      showToast('info', 'PayPal payment cancelled.');
    },
  }).render('#paypal-button-container');
}

/* ═══════════════════════════════════════════════════════════════
   FLUTTERWAVE
═══════════════════════════════════════════════════════════════ */
async function submitFlutterwave({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous }) {
  showLoading('Initialising payment…');

  const res = await apiPost('/payments/flutterwave/initiate', {
    donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous,
  });
  hideLoading();
  if (!res.success) throw new Error(res.message);

  /* Load Flutterwave inline JS */
  if (!window.FlutterwaveCheckout) {
    await loadScript('https://checkout.flutterwave.com/v3.js');
  }

  window.FlutterwaveCheckout({
    ...res.flwConfig,
    callback: async (response) => {
      if (response.status === 'successful') {
        showLoading('Verifying payment…');
        const verify = await apiPost('/payments/flutterwave/verify', {
          transactionId: response.transaction_id,
          txRef:         response.tx_ref,
        });
        hideLoading();
        if (verify.success) {
          resetForm();
          showSuccessModal({ donorName, amount, currency, gateway: 'Flutterwave / Mobile Money' });
        } else {
          showToast('error', 'Payment verification failed. Please contact us with your reference.');
        }
      } else {
        showToast('error', `Payment not completed (status: ${response.status}).`);
      }
    },
    onclose: () => {
      showToast('info', 'Payment window closed. You can try again anytime.');
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   BANK TRANSFER
═══════════════════════════════════════════════════════════════ */
async function submitBankTransfer({ donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous }) {
  showLoading('Generating your transfer reference…');

  const res = await apiPost('/payments/bank-transfer/initiate', {
    donorName, donorEmail, donorPhone, amount, currency, program, message, isAnonymous,
  });
  hideLoading();
  if (!res.success) throw new Error(res.message);

  resetForm();
  showBankTransferModal({ donorName, amount, currency, reference: res.reference, bankDetails: res.bankDetails });
}

/* ═══════════════════════════════════════════════════════════════
   ITEMS DONATION
═══════════════════════════════════════════════════════════════ */
async function submitItemsDonation({ donorName, donorEmail, donorPhone, itemsDescription, itemsPickupAddress, program, message }) {
  showLoading('Registering your donation…');

  const res = await apiPost('/payments/items', {
    donorName, donorEmail, donorPhone, itemsDescription, itemsPickupAddress, program, message,
  });
  hideLoading();
  if (!res.success) throw new Error(res.message);

  resetForm();
  showToast('success', `Thank you, ${donorName}! Your items donation is registered. Check your email for details. God bless you! 🙏`, 8000);
}

/* ═══════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════ */

/* Success modal — shown after card/PayPal/Flutterwave payment */
function showSuccessModal({ donorName, amount, currency, gateway }) {
  const overlay = createOverlay();
  overlay.innerHTML = `
    <div class="gpi-modal">
      <div class="modal-emoji">🙏</div>
      <h2>God Bless You, ${donorName}!</h2>
      <div class="modal-amount">${currency} ${parseFloat(amount).toFixed(2)}</div>
      <p>Your donation via <strong>${gateway}</strong> has been received and processed.</p>
      <p>A receipt has been sent to your email address.</p>
      <p style="margin-top:0.75rem;font-size:0.85rem;">
        Your generosity is changing lives — widows, orphans, and street children thank you. ❤️
      </p>
      <button class="modal-btn accent" onclick="document.querySelector('.gpi-overlay').remove()">
        Close
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

/* Bank transfer modal — shows reference + bank details */
function showBankTransferModal({ donorName, amount, currency, reference, bankDetails }) {
  const overlay = createOverlay();
  const rows    = [
    ['Bank Name',       bankDetails?.bankName],
    ['Account Name',    bankDetails?.accountName],
    ['Account Number',  bankDetails?.accountNumber],
    ['Sort Code',       bankDetails?.sortCode],
    ['SWIFT / BIC',     bankDetails?.swiftCode],
    ['IBAN',            bankDetails?.iban],
  ];

  overlay.innerHTML = `
    <div class="gpi-modal" style="max-width:520px;text-align:left;">
      <button class="modal-close-x" onclick="document.querySelector('.gpi-overlay').remove()" aria-label="Close">&times;</button>
      <div style="text-align:center;">
        <div class="modal-emoji">🏦</div>
        <h2>Bank Transfer Details</h2>
        <p>Thank you, <strong>${donorName}</strong>! Please transfer
          <strong>${currency} ${parseFloat(amount).toFixed(2)}</strong> using the details below.</p>
      </div>

      <div class="bank-modal-table">
        ${rows.map(([label, val]) => `
          <div class="bank-modal-row">
            <span>${label}</span>
            <strong>${val || '—'}</strong>
          </div>
        `).join('')}
      </div>

      <div class="bank-ref-label">⚠️ Use this exact reference number in your transfer:</div>
      <div class="bank-ref-box">${reference}</div>

      <div class="bank-warning">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Include the reference above so we can identify your payment instantly.
      </div>

      <p style="font-size:0.85rem;color:#64748b;text-align:center;margin-bottom:0;">
        Full instructions have been emailed to you. Transfers typically clear in 1–3 business days.
        Reply to that email with your confirmation screenshot to speed things up.
      </p>

      <button class="modal-btn" style="margin-top:1.5rem;" onclick="document.querySelector('.gpi-overlay').remove()">
        <i class="fa-solid fa-check"></i> Got it — I'll Transfer Now
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
}

/* ═══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
═══════════════════════════════════════════════════════════════ */
function showToast(type, message, duration = 6000) {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info', warning:'fa-triangle-exclamation' };
  const toast = document.createElement('div');
  toast.className = `gpi-toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i>
    <span>${message}</span>
    <span class="toast-close" aria-label="Dismiss">&times;</span>
  `;

  /* Remove any existing toast */
  document.querySelectorAll('.gpi-toast').forEach(t => t.remove());
  document.body.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('exiting');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

/* ═══════════════════════════════════════════════════════════════
   LOADING OVERLAY
═══════════════════════════════════════════════════════════════ */
function showLoading(message = 'Processing…') {
  hideLoading();
  const el = document.createElement('div');
  el.className  = 'gpi-loading';
  el.id         = 'gpiLoadingOverlay';
  el.setAttribute('role', 'status');
  el.innerHTML  = `<i class="fa-solid fa-spinner"></i><span>${message}</span>`;
  document.body.appendChild(el);
}

function hideLoading() {
  const el = document.getElementById('gpiLoadingOverlay');
  if (el) el.remove();
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/* Generic API POST wrapper */
async function apiPost(path, body) {
  const res  = await fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}

/* Create a backdrop overlay element */
function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'gpi-overlay';
  /* Click outside modal to close */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  return overlay;
}

/* Dynamically load an external script */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

/* Reset the donation form */
function resetForm() {
  const form = document.getElementById('donateForm');
  if (!form) return;
  form.reset();
  /* Reset amount buttons */
  document.querySelectorAll('.amount-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  /* Reset gateway tabs */
  document.querySelectorAll('.gateway-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  /* Reset donation type view */
  const moneyFields    = document.getElementById('moneyFields');
  const itemsFields    = document.getElementById('itemsFields');
  const gatewaySection = document.getElementById('gatewaySection');
  if (moneyFields)    moneyFields.style.display    = 'block';
  if (itemsFields)    itemsFields.style.display    = 'none';
  if (gatewaySection) gatewaySection.style.display = 'block';
}

/* Submit button loading state */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled           = true;
    btn.dataset.origText   = btn.innerHTML;
    btn.innerHTML          = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
  } else {
    btn.disabled  = false;
    btn.innerHTML = btn.dataset.origText || '<i class="fa-solid fa-heart"></i> Donate Now';
  }
}

/* Basic email validation */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

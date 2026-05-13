const express  = require('express');
const router   = express.Router();
const jwt      = require('jsonwebtoken');
const Admin    = require('../models/Admin');
const Donation = require('../models/Donation');
const { protect, superAdminOnly } = require('../middleware/auth');
const { sendDonorReceipt } = require('../utils/sendEmail');

/* ── Auth ────────────────────────────────────────────────────────── */

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    admin.lastLogin = Date.now();
    await admin.save();

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.json({
      success: true,
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', protect, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

/* ── Dashboard stats ─────────────────────────────────────────────── */

router.get('/stats', protect, async (req, res) => {
  try {
    const [total, completed, pending, failed, revenueAgg, byGateway, byProgram, recent] = await Promise.all([
      Donation.countDocuments(),
      Donation.countDocuments({ status: 'completed' }),
      Donation.countDocuments({ status: 'pending' }),
      Donation.countDocuments({ status: 'failed' }),
      Donation.aggregate([
        { $match: { status: 'completed', donationType: { $ne: 'items' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Donation.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$gateway', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Donation.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$program', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Donation.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    res.json({
      success: true,
      stats: {
        totalDonations:    total,
        completedDonations: completed,
        pendingDonations:  pending,
        failedDonations:   failed,
        totalRevenue:      revenueAgg[0]?.total || 0,
        byGateway,
        byProgram,
        recentDonations:   recent,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Donations list ──────────────────────────────────────────────── */

router.get('/donations', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, gateway, donationType, search } = req.query;
    const filter = {};
    if (status)       filter.status       = status;
    if (gateway)      filter.gateway      = gateway;
    if (donationType) filter.donationType = donationType;
    if (search) {
      filter.$or = [
        { donorName:     { $regex: search, $options: 'i' } },
        { donorEmail:    { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip      = (parseInt(page) - 1) * parseInt(limit);
    const donations = await Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean();
    const total     = await Donation.countDocuments(filter);

    res.json({
      success:   true,
      donations,
      total,
      page:      parseInt(page),
      pages:     Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/donations/:id', protect, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Confirm bank transfer / update status / add notes
router.patch('/donations/:id', protect, async (req, res) => {
  try {
    const { status, adminNotes, bankTransferConfirmedAt } = req.body;
    const updates = {};
    if (status)                  updates.status = status;
    if (adminNotes)              updates.adminNotes = adminNotes;
    if (bankTransferConfirmedAt) updates.bankTransferConfirmedAt = bankTransferConfirmedAt;

    const donation = await Donation.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!donation) return res.status(404).json({ success: false, message: 'Not found' });

    // Send receipt if bank transfer just confirmed
    if (status === 'completed' && donation.gateway === 'bank_transfer' && !donation.receiptSent) {
      await sendDonorReceipt(donation);
      donation.receiptSent = true;
      await donation.save();
    }

    res.json({ success: true, donation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Admin management (super admin only) ─────────────────────────── */

router.post('/admins', protect, superAdminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password required' });
    const admin = await Admin.create({ name, email, password, role: role || 'admin' });
    res.status(201).json({
      success: true,
      admin:   { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admins', protect, superAdminOnly, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admins/:id', protect, superAdminOnly, async (req, res) => {
  try {
    if (String(req.admin._id) === req.params.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await Admin.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Admin deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

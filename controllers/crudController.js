const Child = require('../models/Child');
const { Family, Visit, DailyWorkReport } = require('../models/index');

// ─── CHILDREN ────────────────────────────────────────────
exports.getAllChildren = async (req, res) => {
  const { village, nutrition_status, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  if (nutrition_status) filter.nutrition_status = nutrition_status;
  if (req.user.role === 'ASHA' && req.user.assigned_villages?.length > 0) filter.village = { $in: req.user.assigned_villages };

  const skip = (page - 1) * limit;
  const [children, total] = await Promise.all([
    Child.find(filter).sort({ nutrition_status: -1, updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Child.countDocuments(filter),
  ]);
  res.json({ success: true, data: children, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getChild = async (req, res) => {
  const child = await Child.findById(req.params.id).lean();
  if (!child) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: child });
};

exports.createChild = async (req, res) => {
  const child = await Child.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: child });
};

exports.updateChild = async (req, res) => {
  const child = await Child.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!child) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: child });
};

// ─── VISITS ──────────────────────────────────────────────
exports.getAllVisits = async (req, res) => {
  const { village, priority, date, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (req.user.role === 'ASHA') filter.asha_id = req.user._id;
  if (village) filter.village = village;
  if (priority) filter['follow_up.priority'] = priority;
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    filter.date = { $gte: d, $lt: nextDay };
  }
  const skip = (page - 1) * limit;
  const [visits, total] = await Promise.all([
    Visit.find(filter).sort({ date: -1 }).skip(skip).limit(Number(limit))
      .populate('asha_id', 'name').lean(),
    Visit.countDocuments(filter),
  ]);
  res.json({ success: true, data: visits, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.createVisit = async (req, res) => {
  const visit = await Visit.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: visit });
};

exports.getVisit = async (req, res) => {
  const visit = await Visit.findById(req.params.id).populate('asha_id', 'name').lean();
  if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: visit });
};

// ─── FAMILIES ─────────────────────────────────────────────
exports.getAllFamilies = async (req, res) => {
  const { village, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  if (req.user.role === 'ASHA' && req.user.assigned_villages?.length > 0) filter.village = { $in: req.user.assigned_villages };

  const skip = (page - 1) * limit;
  const [families, total] = await Promise.all([
    Family.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Family.countDocuments(filter),
  ]);
  res.json({ success: true, data: families, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getFamily = async (req, res) => {
  const family = await Family.findById(req.params.id).lean();
  if (!family) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: family });
};

exports.createFamily = async (req, res) => {
  const family = await Family.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: family });
};

exports.updateFamily = async (req, res) => {
  const family = await Family.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!family) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: family });
};

// ─── REPORTS ──────────────────────────────────────────────
exports.getReports = async (req, res) => {
  const filter = {};
  if (req.user.role === 'ASHA') filter.asha_id = req.user._id;
  const reports = await DailyWorkReport.find(filter)
    .sort({ date: -1 }).limit(60).populate('asha_id', 'name').lean();
  res.json({ success: true, data: reports });
};

exports.createReport = async (req, res) => {
  const report = await DailyWorkReport.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: report });
};

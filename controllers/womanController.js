const Woman = require('../models/Woman');
const safeUpdate = require('../utils/safeUpdate');
const asyncHandler = require('../utils/asyncHandler');

const womanUpdateFields = {
  name: true, age: true, mobile: true, address: true, village: true, taluka: true, district: true,
  pregnancy_status: true, pregnancy_month: true, edd: true, lmp: true, high_risk: true,
  medical_metrics: { weight: true, bp_sys: true, bp_dia: true, hemoglobin: true, diabetes: true, thyroid: true },
  gov_schemes: { mamta_card: true, jsy: true },
  checkups: { last_date: true, next_date: true },
  active: true,
};

exports.getAll = async (req, res) => {
  const { village, high_risk, pregnancy_status, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  if (high_risk !== undefined) filter.high_risk = high_risk === 'true';
  if (pregnancy_status !== undefined) filter.pregnancy_status = pregnancy_status === 'true';

  // ASHA workers only see records they personally created; Admin sees all
  if (req.user.role === 'ASHA') {
    filter.asha_id = req.user._id;
  }

  const skip = (page - 1) * limit;
  const [women, total] = await Promise.all([
    Woman.find(filter).sort({ high_risk: -1, updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Woman.countDocuments(filter),
  ]);

  res.json({ success: true, data: women, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getOne = asyncHandler(async (req, res) => {
  const woman = await Woman.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).lean();
  if (!woman) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: woman });
});

exports.create = async (req, res) => {
  const woman = await Woman.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: woman });
};

exports.update = asyncHandler(async (req, res) => {
  const update = safeUpdate(req.body, womanUpdateFields);
  if (!update) return res.status(400).json({ success: false, message: 'Invalid update fields' });
  const woman = await Woman.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, update, { new: true, runValidators: true });
  if (!woman) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: woman });
});

exports.remove = asyncHandler(async (req, res) => {
  const woman = await Woman.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, { active: false });
  if (!woman) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, message: 'Record deactivated' });
});

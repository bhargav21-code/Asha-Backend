const Woman = require('../models/Woman');

exports.getAll = async (req, res) => {
  const { village, high_risk, pregnancy_status, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  if (high_risk !== undefined) filter.high_risk = high_risk === 'true';
  if (pregnancy_status !== undefined) filter.pregnancy_status = pregnancy_status === 'true';

  // ASHA workers only see their villages (if any are assigned)
  if (req.user.role === 'ASHA' && req.user.assigned_villages?.length > 0) {
    filter.village = { $in: req.user.assigned_villages };
  }

  const skip = (page - 1) * limit;
  const [women, total] = await Promise.all([
    Woman.find(filter).sort({ high_risk: -1, updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Woman.countDocuments(filter),
  ]);

  res.json({ success: true, data: women, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const woman = await Woman.findById(req.params.id).lean();
  if (!woman) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: woman });
};

exports.create = async (req, res) => {
  const woman = await Woman.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: woman });
};

exports.update = async (req, res) => {
  const woman = await Woman.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!woman) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: woman });
};

exports.remove = async (req, res) => {
  await Woman.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ success: true, message: 'Record deactivated' });
};

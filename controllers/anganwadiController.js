const Anganwadi = require('../models/Anganwadi');
const safeUpdate = require('../utils/safeUpdate');

const anganwadiUpdateFields = {
  district: true, taluka: true, village: true, anganwadi_name: true,
  worker_name: true, contact_number: true, active: true,
  facility: {
    drinking_water: true, toilet: true, electricity: true,
    nutrition_stock: true, building_condition: true,
  },
  children: [{
    _id: true, child_name: true, age: true, gender: true, weight: true,
    height: true, nutrition_status: true, vaccination_status: true, present_today: true,
  }],
};

exports.getAll = async (req, res) => {
  try {
    const filter = { active: true };
    if (req.user.role === 'ASHA') filter.asha_id = req.user._id;
    const records = await Anganwadi.find(filter).sort({ updatedAt: -1 }).lean({ virtuals: true });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const record = await Anganwadi.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).lean({ virtuals: true });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const record = await Anganwadi.create({ ...req.body, asha_id: req.user._id });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const update = safeUpdate(req.body, anganwadiUpdateFields);
    if (!update) return res.status(400).json({ success: false, message: 'Invalid update fields' });
    const record = await Anganwadi.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, update, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.addChild = async (req, res) => {
  try {
    const record = await Anganwadi.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    record.children.push(req.body);
    await record.save();
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    // req.body = { present_ids: ['childId1', 'childId2', ...] }
    const record = await Anganwadi.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    const presentSet = new Set(req.body.present_ids || []);
    record.children.forEach(c => { c.present_today = presentSet.has(c._id.toString()); });
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const record = await Anganwadi.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, { active: false });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

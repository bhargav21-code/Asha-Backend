const SurveyForm = require('../models/SurveyForm');

exports.getAll = async (req, res) => {
  try {
    const filter = { active: true };
    // Survey forms are shared across all ASHA workers (no creator-based restriction)
    const { search } = req.query;
    if (search) filter.form_name = { $regex: search, $options: 'i' };
    const forms = await SurveyForm.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: forms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const form = await SurveyForm.findById(req.params.id).lean();
    if (!form) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: form });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const form = await SurveyForm.create({ ...req.body, asha_id: req.user._id });
    res.status(201).json({ success: true, data: form });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const form = await SurveyForm.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!form) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: form });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await SurveyForm.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

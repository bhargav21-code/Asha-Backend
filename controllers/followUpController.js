const FollowUp = require('../models/FollowUp');

exports.getAll = async (req, res) => {
  try {
    const filter = { active: true };
    if (req.user.role === 'ASHA') filter.asha_id = req.user._id;
    const { status, priority, village, search } = req.query;
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (village)  filter.village  = village;
    if (search)   filter.patient_name = { $regex: search, $options: 'i' };

    const records = await FollowUp.find(filter).sort({ next_followup_date: 1 }).lean();
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const record = await FollowUp.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const record = await FollowUp.create({ ...req.body, asha_id: req.user._id });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const record = await FollowUp.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, Object.fromEntries(Object.entries(req.body).filter(([key]) => key !== 'asha_id')), { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.addVisitHistory = async (req, res) => {
  try {
    const record = await FollowUp.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    record.visit_history.push(req.body);
    record.last_visit_date = req.body.visit_date || new Date();
    await record.save();
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    const filter = { active: true };
    if (req.user.role === 'ASHA') filter.asha_id = req.user._id;

    if (year && month) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 1);
      filter.next_followup_date = { $gte: start, $lt: end };
    }

    const records = await FollowUp.find(filter)
      .select('patient_name next_followup_date status priority village disease_name')
      .sort({ next_followup_date: 1 })
      .lean();
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await FollowUp.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, { active: false });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

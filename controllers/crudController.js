const mongoose = require('mongoose');
const Child = require('../models/Child');
const Woman = require('../models/Woman');
const { Family, Visit, DailyWorkReport } = require('../models/index');
const safeUpdate = require('../utils/safeUpdate');
const asyncHandler = require('../utils/asyncHandler');

const childUpdateFields = {
  name: true, dob: true, gender: true, village: true, taluka: true, district: true,
  mother_id: true, family_id: true, growth_metrics: {
    weight: true, height: true, head_circumference: true, muac: true,
  }, vaccinations: {
    bcg: true, opv0: true, hepB: true, opv1: true, penta1: true, mr: true, vitamin_a: true,
  }, nutrition_status: true, active: true,
};
const familyMemberUpdateFields = {
  name: true, age: true, gender: true, relation: true,
  conditions: { bp: true, diabetes: true, tb: true, anemia: true },
};
const familyUpdateFields = {
  head_name: true, mobile: true, village: true, taluka: true, district: true, address: true, active: true,
  conditions: { toilet: true, water_source: true, electricity: true, lpg: true },
};

// ─── CHILDREN ────────────────────────────────────────────
exports.getAllChildren = async (req, res) => {
  const { village, nutrition_status, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  if (nutrition_status) filter.nutrition_status = nutrition_status;
  // ASHA workers only see records they personally created; Admin sees all
  if (req.user.role === 'ASHA') filter.asha_id = req.user._id;

  const skip = (page - 1) * limit;
  const [children, total] = await Promise.all([
    Child.find(filter).sort({ nutrition_status: -1, updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Child.countDocuments(filter),
  ]);
  res.json({ success: true, data: children, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getChild = asyncHandler(async (req, res) => {
  const child = await Child.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).lean();
  if (!child) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: child });
});


exports.createChild = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Admin') {
    if (Object.prototype.hasOwnProperty.call(req.body, 'mother_id') && req.body.mother_id !== null) {
      if (typeof req.body.mother_id !== 'string' || !mongoose.Types.ObjectId.isValid(req.body.mother_id))
        return res.status(400).json({ success: false, message: 'Invalid mother reference' });

      const mother = await Woman.exists({
        _id: req.body.mother_id,
        asha_id: req.user._id,
      });

      if (!mother)
        return res.status(404).json({ success: false, message: 'Mother not found' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'family_id') && req.body.family_id !== null) {
      if (typeof req.body.family_id !== 'string' || !mongoose.Types.ObjectId.isValid(req.body.family_id))
        return res.status(400).json({ success: false, message: 'Invalid family reference' });

      const family = await Family.exists({
        _id: req.body.family_id,
        asha_id: req.user._id,
      });

      if (!family)
        return res.status(404).json({ success: false, message: 'Family not found' });
    }
  }

  const child = await Child.create({
    ...req.body,
    asha_id: req.user._id,
  });

  res.status(201).json({ success: true, data: child });
});


exports.updateChild = asyncHandler(async (req, res) => {
  const update = safeUpdate(req.body, childUpdateFields);
  if (!update) return res.status(400).json({ success: false, message: 'Invalid update fields' });

  if (req.user.role !== 'Admin') {
    if (Object.prototype.hasOwnProperty.call(update, 'mother_id') && update.mother_id !== null) {
      if (typeof update.mother_id !== 'string' || !mongoose.Types.ObjectId.isValid(update.mother_id))
        return res.status(400).json({ success: false, message: 'Invalid mother reference' });
      const mother = await Woman.exists({ _id: update.mother_id, asha_id: req.user._id });
      if (!mother) return res.status(404).json({ success: false, message: 'Mother not found' });
    }

    if (Object.prototype.hasOwnProperty.call(update, 'family_id') && update.family_id !== null) {
      if (typeof update.family_id !== 'string' || !mongoose.Types.ObjectId.isValid(update.family_id))
        return res.status(400).json({ success: false, message: 'Invalid family reference' });
      const family = await Family.exists({ _id: update.family_id, asha_id: req.user._id });
      if (!family) return res.status(404).json({ success: false, message: 'Family not found' });
    }
  }

  const child = await Child.findOne(req.user.role === 'Admin'
    ? { _id: req.params.id }
    : { _id: req.params.id, asha_id: req.user._id });
  if (!child) return res.status(404).json({ success: false, message: 'Not found' });

  // Use save() so the Child pre-save hook refreshes age_months and nutrition_status.
  child.set(update);
  await child.save();
  res.json({ success: true, data: child });
});

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


exports.createVisit = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Admin') {
    if (req.body.family_id != null) {
      if (typeof req.body.family_id !== 'string' ||
          !mongoose.Types.ObjectId.isValid(req.body.family_id)) {
        return res.status(400).json({
          success: false, message: 'Invalid family reference'
        });
      }

      const family = await Family.exists({
        _id: req.body.family_id,
        asha_id: req.user._id,
      });

      if (!family) {
        return res.status(404).json({
          success: false, message: 'Family not found'
        });
      }
    }

    if (req.body.individual_id != null) {
      if (!mongoose.Types.ObjectId.isValid(req.body.individual_id) ||
          !['Woman', 'Child'].includes(req.body.individual_type)) {
        return res.status(400).json({
          success: false, message: 'Invalid individual reference'
        });
      }

      const Model = req.body.individual_type === 'Woman'
        ? Woman
        : Child;

      const individual = await Model.exists({
        _id: req.body.individual_id,
        asha_id: req.user._id,
      });

      if (!individual) {
        return res.status(404).json({
          success: false, message: 'Individual not found'
        });
      }
    }
  }

  const visit = await Visit.create({
    ...req.body,
    asha_id: req.user._id,
  });

  res.status(201).json({ success: true, data: visit });
});


exports.getVisit = asyncHandler(async (req, res) => {
  const visit = await Visit.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).populate('asha_id', 'name').lean();
  if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: visit });
});

// ─── FAMILIES ─────────────────────────────────────────────
exports.getAllFamilies = async (req, res) => {
  const { village, page = 1, limit = 20 } = req.query;
  const filter = { active: true };
  if (village) filter.village = village;
  // ASHA workers only see records they personally created; Admin sees all
  if (req.user.role === 'ASHA') filter.asha_id = req.user._id;

  const skip = (page - 1) * limit;
  const [families, total] = await Promise.all([
    Family.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Family.countDocuments(filter),
  ]);
  res.json({ success: true, data: families, total, page: Number(page), pages: Math.ceil(total / limit) });
};

exports.getFamily = asyncHandler(async (req, res) => {
  const family = await Family.findOne(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }).lean();
  if (!family) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: family });
});

exports.createFamily = async (req, res) => {
  const family = await Family.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: family });
};

exports.updateFamily = asyncHandler(async (req, res) => {
  const update = safeUpdate(req.body, familyUpdateFields);
  if (!update) return res.status(400).json({ success: false, message: 'Invalid update fields' });
  const family = await Family.findOneAndUpdate(req.user.role === 'Admin' ? { _id: req.params.id } : { _id: req.params.id, asha_id: req.user._id }, update, { new: true, runValidators: true });
  if (!family) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data: family });
});

exports.updateFamilyMember = asyncHandler(async (req, res) => {
  const update = safeUpdate(req.body, familyMemberUpdateFields);
  if (!update) return res.status(400).json({ success: false, message: 'Invalid member fields' });
  if (!mongoose.isValidObjectId(req.params.memberId))
    return res.status(404).json({ success: false, message: 'Family member not found' });

  const memberUpdate = Object.fromEntries(
    Object.entries(update).map(([field, value]) => [`members.$.${field}`, value])
  );
  const filter = req.user.role === 'Admin'
    ? { _id: req.params.id, 'members._id': req.params.memberId }
    : { _id: req.params.id, asha_id: req.user._id, 'members._id': req.params.memberId };
  const family = await Family.findOneAndUpdate(filter, { $set: memberUpdate }, { new: true, runValidators: true });
  if (!family) return res.status(404).json({ success: false, message: 'Family or member not found' });
  res.json({ success: true, data: family });
});


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

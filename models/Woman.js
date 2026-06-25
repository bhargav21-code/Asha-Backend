const mongoose = require('mongoose');

const womanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  mobile: { type: String, trim: true },
  aadhaar: {
    type: String,
    select: false, // Never returned in standard queries — privacy protection
    trim: true,
  },
  address: { type: String },
  village: { type: String, required: true, index: true },
  taluka: { type: String },
  district: { type: String },
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pregnancy_status: { type: Boolean, default: false },
  pregnancy_month: { type: Number, min: 1, max: 9 },
  edd: { type: Date },
  lmp: { type: Date },
  high_risk: { type: Boolean, default: false, index: true },
  medical_metrics: {
    weight: { type: Number },
    bp_sys: { type: Number },
    bp_dia: { type: Number },
    hemoglobin: { type: Number },
    diabetes: { type: Boolean, default: false },
    thyroid: { type: Boolean, default: false },
  },
  gov_schemes: {
    mamta_card: { type: Boolean, default: false },
    jsy: { type: Boolean, default: false },
  },
  checkups: {
    last_date: { type: Date },
    next_date: { type: Date },
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

// Compound indexes for performance
womanSchema.index({ high_risk: 1, village: 1 });
womanSchema.index({ village: 1, pregnancy_status: 1 });

// AI High-Risk Auto-Flag Hook
womanSchema.pre('save', function (next) {
  const m = this.medical_metrics;
  if (!m) return next();

  const isHighRisk =
    (m.hemoglobin !== undefined && m.hemoglobin < 11.0) ||
    (m.bp_sys !== undefined && m.bp_sys > 140) ||
    (m.bp_dia !== undefined && m.bp_dia > 90) ||
    m.diabetes === true ||
    m.thyroid === true;

  this.high_risk = isHighRisk;
  next();
});

// Also run on findOneAndUpdate
womanSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const m = update?.medical_metrics || update?.$set?.medical_metrics;
  if (!m) return next();

  const isHighRisk =
    (m.hemoglobin !== undefined && m.hemoglobin < 11.0) ||
    (m.bp_sys !== undefined && m.bp_sys > 140) ||
    (m.bp_dia !== undefined && m.bp_dia > 90) ||
    m.diabetes === true ||
    m.thyroid === true;

  this.set({ high_risk: isHighRisk });
  next();
});

module.exports = mongoose.model('Woman', womanSchema);

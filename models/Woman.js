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

function numericMetric(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isBelowThreshold(value, threshold) {
  const number = numericMetric(value);
  return number !== null && number < threshold;
}

function isAboveThreshold(value, threshold) {
  const number = numericMetric(value);
  return number !== null && number > threshold;
}

function calculateHighRisk(metrics = {}) {
  return (
    isBelowThreshold(metrics.hemoglobin, 11.0) ||
    isAboveThreshold(metrics.bp_sys, 140) ||
    isAboveThreshold(metrics.bp_dia, 90) ||
    metrics.diabetes === true ||
    metrics.diabetes === 'true' ||
    metrics.thyroid === true ||
    metrics.thyroid === 'true'
  );
}

// AI High-Risk Auto-Flag Hook
womanSchema.pre('save', function (next) {
  this.high_risk = calculateHighRisk(this.medical_metrics || {});
  next();
});

// Also run on findOneAndUpdate. Resolve partial/dotted metric updates against
// the persisted metrics so one changed measurement cannot erase another's risk.
womanSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate() || {};
  const sources = [update, update.$set || {}];
  const metricChanges = {};
  let hasMetricChanges = false;

  for (const source of sources) {
    if (source.medical_metrics && typeof source.medical_metrics === 'object' && !Array.isArray(source.medical_metrics)) {
      Object.assign(metricChanges, source.medical_metrics);
      hasMetricChanges = true;
    }

    for (const [path, value] of Object.entries(source)) {
      if (path.startsWith('medical_metrics.')) {
        metricChanges[path.slice('medical_metrics.'.length)] = value;
        hasMetricChanges = true;
      }
    }
  }

  if (!hasMetricChanges) return;

  const current = await this.model.findOne(this.getQuery())
    .select('medical_metrics')
    .session(this.getOptions().session || null)
    .lean();
  if (!current) return;

  const resultingMetrics = { ...(current.medical_metrics || {}), ...metricChanges };
  this.set({ high_risk: calculateHighRisk(resultingMetrics) });
});

module.exports = mongoose.model('Woman', womanSchema);

const mongoose = require('mongoose');

// ─── FAMILY ───────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  relation: { type: String },
  conditions: {
    bp: { type: Boolean, default: false },
    diabetes: { type: Boolean, default: false },
    tb: { type: Boolean, default: false },
    anemia: { type: Boolean, default: false },
  },
}, { _id: true });

const familySchema = new mongoose.Schema({
  head_name: { type: String, required: true, trim: true },
  mobile: { type: String },
  village: { type: String, required: true, index: true },
  taluka: { type: String },
  district: { type: String },
  address: { type: String },
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  conditions: {
    toilet: { type: Boolean, default: false },
    water_source: { type: String, enum: ['Tap', 'Well', 'River', 'Tanker', 'Other'], default: 'Other' },
    electricity: { type: Boolean, default: false },
    lpg: { type: Boolean, default: false },
  },
  members: [memberSchema],
  active: { type: Boolean, default: true },
}, { timestamps: true });

// ─── VISIT ────────────────────────────────────────────────
const visitSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  village: { type: String, required: true },
  family_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
  target_individual_name: { type: String },
  individual_type: { type: String, enum: ['Woman', 'Child'] },
  individual_id: { type: mongoose.Schema.Types.ObjectId },
  visit_type: {
    type: String,
    enum: ['Pregnancy', 'Child', 'Vaccination', 'General', 'Postnatal'],
    required: true,
  },
  metrics: {
    weight: { type: Number },
    bp_sys: { type: Number },
    bp_dia: { type: Number },
    temperature: { type: Number },
    blood_sugar: { type: Number },
    hemoglobin: { type: Number },
  },
  actions_taken: {
    counseling: { type: Boolean, default: false },
    referral: { type: Boolean, default: false },
    medicine_given: { type: Boolean, default: false },
    notes: { type: String },
  },
  follow_up: {
    required: { type: Boolean, default: false },
    next_date: { type: Date },
    priority: { type: String, enum: ['Green', 'Yellow', 'Red'], default: 'Green' },
  },
}, { timestamps: true });

// Compound indexes
visitSchema.index({ village: 1, date: -1 });
visitSchema.index({ asha_id: 1, date: -1 });

// AI Triage Priority Hook
visitSchema.pre('save', function (next) {
  const m = this.metrics || {};
  const isHighRisk =
    (m.bp_sys && m.bp_sys > 140) ||
    (m.bp_dia && m.bp_dia > 90) ||
    (m.hemoglobin && m.hemoglobin < 11) ||
    (m.blood_sugar && m.blood_sugar > 200) ||
    this.actions_taken?.referral === true;

  const isMissedCheckup = false; // Extend with checkup logic

  if (isHighRisk) {
    this.follow_up.priority = 'Red';
    this.follow_up.required = true;
  } else if (isMissedCheckup) {
    this.follow_up.priority = 'Yellow';
    this.follow_up.required = true;
  } else {
    this.follow_up.priority = 'Green';
  }

  next();
});

// ─── DAILY WORK REPORT ────────────────────────────────────
const dailyWorkReportSchema = new mongoose.Schema({
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, default: Date.now },
  village: { type: String, required: true },
  homes_visited: { type: Number, default: 0 },
  pregnant_visited: { type: Number, default: 0 },
  children_checked: { type: Number, default: 0 },
  referrals_made: { type: Number, default: 0 },
  sessions_conducted: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true });

dailyWorkReportSchema.index({ asha_id: 1, date: -1 });

module.exports = {
  Family: mongoose.model('Family', familySchema),
  Visit: mongoose.model('Visit', visitSchema),
  DailyWorkReport: mongoose.model('DailyWorkReport', dailyWorkReportSchema),
};

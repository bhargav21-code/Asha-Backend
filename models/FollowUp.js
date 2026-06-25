const mongoose = require('mongoose');

const visitHistorySchema = new mongoose.Schema({
  visit_date:       { type: Date, required: true },
  visit_type:       { type: String, enum: ['Pregnancy', 'Child', 'Vaccination', 'General', 'Postnatal', 'Follow-Up'], default: 'Follow-Up' },
  health_assessment:{ type: String },
  observations:     { type: String },
  actions_taken:    { type: String },
  referral_details: { type: String },
  follow_up_required: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

const followUpSchema = new mongoose.Schema({
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Patient Information
  patient_name:   { type: String, required: true, trim: true },
  age:            { type: Number },
  gender:         { type: String, enum: ['Male', 'Female', 'Other'] },
  village:        { type: String, trim: true },
  mobile_number:  { type: String, trim: true },

  // Disease Information
  disease_name:     { type: String, trim: true },
  disease_category: {
    type: String,
    enum: ['Maternal', 'Child', 'Communicable', 'Non-Communicable', 'Nutritional', 'Other'],
    default: 'Other',
  },
  description:      { type: String },
  symptoms:         { type: String },
  current_health_status: {
    type: String,
    enum: ['Critical', 'Serious', 'Stable', 'Improving', 'Recovered'],
    default: 'Stable',
  },

  // Visit Information
  last_visit_date:   { type: Date },
  next_followup_date:{ type: Date, required: true },

  // Treatment Tracking
  medicine_prescribed: { type: String },
  treatment_notes:     { type: String },
  referral_information:{ type: String },
  hospital_visit_status:{
    type: String,
    enum: ['Not Required', 'Referred', 'Visited', 'Admitted', 'Discharged'],
    default: 'Not Required',
  },

  // Follow-Up Status
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Missed', 'Rescheduled'],
    default: 'Pending',
  },

  // Priority (maps to calendar colours)
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium',
  },

  // Visit History Timeline
  visit_history: [visitHistorySchema],

  active: { type: Boolean, default: true },
}, { timestamps: true });

followUpSchema.index({ asha_id: 1, next_followup_date: 1 });
followUpSchema.index({ status: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);

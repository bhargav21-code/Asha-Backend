const mongoose = require('mongoose');

const surveyFormSchema = new mongoose.Schema({
  form_name:   { type: String, required: true, trim: true },
  google_link: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  asha_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

surveyFormSchema.index({ asha_id: 1 });

module.exports = mongoose.model('SurveyForm', surveyFormSchema);

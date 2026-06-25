const mongoose = require('mongoose');

const anganwadiChildSchema = new mongoose.Schema({
  child_name:        { type: String, required: true, trim: true },
  age:               { type: Number, required: true },
  gender:            { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  weight:            { type: Number },
  height:            { type: Number },
  nutrition_status:  { type: String, enum: ['Normal', 'Moderate Malnutrition', 'Severe Malnutrition'], default: 'Normal' },
  vaccination_status:{ type: String, enum: ['Fully Vaccinated', 'Partially Vaccinated', 'Not Vaccinated'], default: 'Partially Vaccinated' },
  present_today:     { type: Boolean, default: false },
}, { _id: true });

const anganwadiSchema = new mongoose.Schema({
  // Location Information
  district:       { type: String, required: true, trim: true },
  taluka:         { type: String, required: true, trim: true },
  village:        { type: String, required: true, trim: true },
  anganwadi_name: { type: String, required: true, trim: true },

  // Anganwadi Details
  worker_name:    { type: String, required: true, trim: true },
  contact_number: { type: String, trim: true },

  // Facility Monitoring
  facility: {
    drinking_water:    { type: Boolean, default: false },
    toilet:            { type: Boolean, default: false },
    electricity:       { type: Boolean, default: false },
    nutrition_stock:   { type: Boolean, default: false },
    building_condition:{ type: String, enum: ['Good', 'Average', 'Poor'], default: 'Good' },
  },

  // Children list
  children: [anganwadiChildSchema],

  // Statistics (auto-computed via virtuals)
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  active:  { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Auto-compute statistics as virtuals
anganwadiSchema.virtual('total_registered').get(function () {
  return this.children.length;
});
anganwadiSchema.virtual('present_today').get(function () {
  return this.children.filter(c => c.present_today).length;
});
anganwadiSchema.virtual('absent_today').get(function () {
  return this.children.filter(c => !c.present_today).length;
});

anganwadiSchema.index({ village: 1 });
anganwadiSchema.index({ asha_id: 1 });

module.exports = mongoose.model('Anganwadi', anganwadiSchema);

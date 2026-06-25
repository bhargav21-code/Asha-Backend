const mongoose = require('mongoose');

// Standard median weights (kg) per age bucket (months) — WHO reference
const STANDARD_WEIGHTS = {
  0: 3.3, 1: 4.5, 2: 5.6, 3: 6.4, 4: 7.0, 5: 7.5, 6: 7.9,
  9: 8.9, 12: 9.6, 18: 10.9, 24: 12.2, 36: 14.3, 48: 16.3, 60: 18.3,
};

function getMedianWeight(ageMonths) {
  const keys = Object.keys(STANDARD_WEIGHTS).map(Number).sort((a, b) => a - b);
  let closest = keys[0];
  for (const k of keys) { if (k <= ageMonths) closest = k; }
  return STANDARD_WEIGHTS[closest];
}

const childSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  age_months: { type: Number }, // Computed
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  village: { type: String, required: true, index: true },
  taluka: { type: String },
  district: { type: String },
  mother_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Woman' },
  family_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Family' },
  asha_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  growth_metrics: {
    weight: { type: Number }, // kg
    height: { type: Number }, // cm
    head_circumference: { type: Number }, // cm
    muac: { type: Number }, // Mid-Upper Arm Circumference cm
  },
  vaccinations: {
    bcg: { type: Boolean, default: false },
    opv0: { type: Boolean, default: false },
    hepB: { type: Boolean, default: false },
    opv1: { type: Boolean, default: false },
    penta1: { type: Boolean, default: false },
    mr: { type: Boolean, default: false },
    vitamin_a: { type: Boolean, default: false },
  },
  nutrition_status: {
    type: String,
    enum: ['Normal', 'Moderate Malnutrition', 'Severe Malnutrition'],
    default: 'Normal',
  },
  active: { type: Boolean, default: true },
}, { timestamps: true });

childSchema.index({ village: 1, nutrition_status: 1 });

// AI Malnutrition Classification Hook
childSchema.pre('save', function (next) {
  // Compute age in months
  if (this.dob) {
    const now = new Date();
    this.age_months = Math.floor(
      (now - this.dob) / (1000 * 60 * 60 * 24 * 30.44)
    );
  }

  const weight = this.growth_metrics?.weight;
  const muac = this.growth_metrics?.muac;

  if (weight !== undefined && this.age_months !== undefined) {
    const median = getMedianWeight(this.age_months);
    const pct = (weight / median) * 100;

    if (pct < 70 || (muac && muac < 11.5)) {
      this.nutrition_status = 'Severe Malnutrition';
    } else if (pct < 80 || (muac && muac < 12.5)) {
      this.nutrition_status = 'Moderate Malnutrition';
    } else {
      this.nutrition_status = 'Normal';
    }
  }

  next();
});

module.exports = mongoose.model('Child', childSchema);

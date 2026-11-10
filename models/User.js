const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emergencyContactSchema = new mongoose.Schema({
  name:         { type: String, trim: true },
  relationship: { type: String, trim: true },
  phone:        { type: String, trim: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  username:         { type: String, unique: true, lowercase: true, trim: true },
  password:         { type: String, minlength: 6, select: false },
  role:             { type: String, enum: ['Admin', 'ASHA'], default: 'ASHA' },
  assigned_villages:[ { type: String, trim: true } ],

  // Extended profile fields
  date_of_birth:    { type: Date },
  age:              { type: Number },
  gender:           { type: String, enum: ['Female', 'Male', 'Other'] },
  address:          { type: String, trim: true },
  phone:            { type: String, trim: true },
  email:            { type: String, trim: true, lowercase: true },
  emergency_contact: emergencyContactSchema,

  // Account status
  active:           { type: Boolean, default: true },
  // For self-registration flow: pending = awaiting admin approval
  approval_status:  { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  // For password/username change requests by ASHA workers
  change_request: {
    type:         { type: String, enum: ['username', 'password'] },
    new_value:    { type: String },
    new_value_hashed: { type: Boolean, default: false },
    requested_at: { type: Date },
    status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },

  otp:              { type: String, select: false },
  otp_expires:      { type: Date, select: false },
  otp_attempts:     { type: Number, default: 0, select: false },
  otp_locked_until: { type: Date, select: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otp_expires;
  delete obj.otp_attempts;
  delete obj.otp_locked_until;
  if (obj.change_request?.type === 'password') {
    delete obj.change_request.new_value;
    delete obj.change_request.new_value_hashed;
  }
  return obj;
};

module.exports = mongoose.model('User', userSchema);

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { sendOTPEmail } = require('../utils/emailService');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });

  const user = await User.findOne({ username }).select('+password');
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  if (!user.active)
    return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });

  if (user.approval_status === 'pending')
    return res.status(403).json({ success: false, message: 'Your registration is pending admin approval.' });

  if (user.approval_status === 'rejected')
    return res.status(403).json({ success: false, message: 'Your registration was rejected. Contact admin.' });

  const token = signToken(user._id);
  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      assigned_villages: user.assigned_villages,
    },
  });
};

// ─── Get current user ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// ─── Admin creates user directly (no approval needed) ─────────────────────────
exports.register = async (req, res) => {
  const { name, username, password, role, assigned_villages, phone } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });
  const user = await User.create({
    name, username, password, role,
    assigned_villages, phone,
    approval_status: 'approved',
  });
  res.status(201).json({ success: true, user });
};

// ─── Public self-registration (ASHA worker applies) ───────────────────────────
exports.selfRegister = async (req, res) => {
  const {
    name, username, password,
    date_of_birth, age, gender, address, phone, email,
    emergency_contact,
  } = req.body;

  if (!name || !username || !password || !phone)
    return res.status(400).json({ success: false, message: 'Name, username, password and phone are required' });

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });

  await User.create({
    name, username, password,
    role: 'ASHA',
    date_of_birth, age, gender, address, phone, email,
    emergency_contact,
    approval_status: 'pending',
    active: false, // activated only after admin approves
  });

  res.status(201).json({
    success: true,
    message: 'Registration submitted. You will be notified once admin approves your account.',
  });
};

// ─── ASHA worker requests username/password change ────────────────────────────
exports.requestChange = async (req, res) => {
  const { type, new_value } = req.body;
  if (!['username', 'password'].includes(type))
    return res.status(400).json({ success: false, message: 'Invalid change type' });
  if (!new_value)
    return res.status(400).json({ success: false, message: 'New value is required' });

  if (type === 'username') {
    const exists = await User.findOne({ username: new_value.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });
  }

  await User.findByIdAndUpdate(req.user._id, {
    change_request: {
      type,
      new_value,
      requested_at: new Date(),
      status: 'pending',
    },
  });

  res.json({ success: true, message: 'Change request submitted. Awaiting admin approval.' });
};

// ─── Forgot Password - Send OTP to email ─────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, message: 'Email is required' });

  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: 'No account found with this email' });

  const otp = generateOTP();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await User.findByIdAndUpdate(user._id, {
    otp,
    otp_expires: expires,
  });

  await sendOTPEmail(email, otp, user.name);

  res.json({ success: true, message: 'OTP sent to your email address' });
};

// ─── Verify OTP and reset password ───────────────────────────
exports.verifyOTP = async (req, res) => {
  const { email, otp, new_password } = req.body;

  const user = await User.findOne({ email }).select('+otp +otp_expires +password');
  if (!user)
    return res.status(404).json({ success: false, message: 'No account found' });

  if (!user.otp || user.otp !== otp)
    return res.status(400).json({ success: false, message: 'Invalid OTP' });

  if (user.otp_expires < new Date())
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });

  if (!new_password || new_password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

  user.password = new_password;
  user.otp = undefined;
  user.otp_expires = undefined;
  await user.save();

  res.json({ success: true, message: 'Password reset successfully! You can now login.' });
};
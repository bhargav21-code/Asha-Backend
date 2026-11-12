const jwt = require('jsonwebtoken');
const { randomInt, createHmac, timingSafeEqual } = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const { sendOTPEmail } = require('../utils/emailService');

const generateOTP = () => randomInt(100000, 1000000).toString();
const hashOTP = (otp) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required to protect OTPs');
  return createHmac('sha256', process.env.JWT_SECRET).update(String(otp)).digest('hex');
};
const otpMatches = (storedDigest, candidate) => {
  if (typeof storedDigest !== 'string' || typeof candidate !== 'string') return false;
  const stored = Buffer.from(storedDigest, 'hex');
  const candidateDigest = Buffer.from(hashOTP(candidate), 'hex');
  return stored.length === candidateDigest.length && timingSafeEqual(stored, candidateDigest);
};

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
  if (typeof new_value !== 'string' || !new_value.trim())
    return res.status(400).json({ success: false, message: 'New value must be a non-empty string' });
  if (type === 'password' && new_value.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

  if (type === 'username') {
    const exists = await User.findOne({ username: new_value.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });
  }

  await User.findByIdAndUpdate(req.user._id, {
    change_request: {
      type,
      new_value: type === 'password' ? await bcrypt.hash(new_value, 12) : new_value,
      new_value_hashed: type === 'password',
      requested_at: new Date(),
      status: 'pending',
    },
  });

  res.json({ success: true, message: 'Change request submitted. Awaiting admin approval.' });
};

// ─── Forgot Password - Send OTP to email ─────────────────────

exports.forgotPassword = async (req, res) => {
  const email = typeof req.body.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required',
    });
  }

  // Avoid account-existence timing signals.
  res.json({
    success: true,
    message: 'If an account exists for that email, an OTP will be sent.',
  });

  setImmediate(async () => {
    try {
      const user = await User.findOne({ email }).select(
        '+otp_locked_until +otp_attempts +otp_last_sent_at'
      );

      const now = new Date();
      const cooldownCutoff = new Date(now.getTime() - 60 * 1000);

      if (!user) {
        return;
      }

      // Recover safely if the process stopped after reserving the fifth attempt
      // but before the normal mismatch handler could write the lockout.
      if (
        Number(user.otp_attempts || 0) >= 5 &&
        !user.otp_locked_until
      ) {
        await User.updateOne(
          {
            _id: user._id,
            otp_attempts: { $gte: 5 },
            otp_locked_until: { $exists: false },
          },
          {
            $set: { otp_locked_until: new Date(now.getTime() + 15 * 60 * 1000) },
            $unset: { otp: 1, otp_expires: 1 },
          }
        );
        return;
      }

      if (user.otp_locked_until && user.otp_locked_until > now) {
        return;
      }

      // Enforce a 60-second cooldown for each account.
      if (user.otp_last_sent_at && user.otp_last_sent_at > cooldownCutoff) {
        return;
      }

      const otp = generateOTP();
      const expires = new Date(now.getTime() + 10 * 60 * 1000);
      const lockoutExpired =
        user.otp_locked_until && user.otp_locked_until <= now;

      const filter = {
        _id: user._id,
        $and: [
          {
            $or: [
              { otp_locked_until: { $exists: false } },
              { otp_locked_until: { $lte: now } },
            ],
          },
          {
            $or: [
              { otp_attempts: { $lt: 5 } },
              { otp_attempts: { $exists: false } },
              { otp_locked_until: { $lte: now } },
            ],
          },
          {
            $or: [
              { otp_last_sent_at: { $exists: false } },
              { otp_last_sent_at: { $lte: cooldownCutoff } },
            ],
          },
        ],
      };

      const otpDigest = hashOTP(otp);
      const update = {
        $set: {
          otp: otpDigest,
          otp_expires: expires,
          otp_last_sent_at: now,
        },
        $unset: {
          otp_locked_until: 1,
        },
      };

      // A completed lockout allows a fresh OTP and a fresh attempt budget.
      if (lockoutExpired) {
        update.$set.otp_attempts = 0;
      }

      // Atomic conditional update prevents concurrent requests bypassing cooldown.
      const result = await User.updateOne(filter, update);

      if (!result.matchedCount) {
        return;
      }

      try {
        await sendOTPEmail(email, otp, user.name);
      } catch (sendError) {
        // Clear only this request's reservation; never erase a newer OTP.
        await User.updateOne(
          {
            _id: user._id,
            otp: otpDigest,
            otp_last_sent_at: now,
          },
          {
            $unset: {
              otp: 1,
              otp_expires: 1,
              otp_last_sent_at: 1,
            },
          }
        );
        throw sendError;
      }
    } catch (err) {
      console.error('Forgot-password OTP processing failed:', err);
    }
  });
};


// ─── Verify OTP and reset password ───────────────────────────
exports.verifyOTP = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { otp, new_password } = req.body;
  if (typeof new_password !== 'string' || new_password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  if (typeof otp !== 'string')
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  const user = await User.findOne({ email }).select('+otp +otp_expires +otp_attempts +otp_locked_until');
  const now = new Date();
  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  // Repair an exhausted attempt budget if a previous process stopped between
  // incrementing the fifth attempt and recording its lockout.
  if (
    Number(user.otp_attempts || 0) >= 5 &&
    !user.otp_locked_until
  ) {
    await User.updateOne(
      {
        _id: user._id,
        otp_attempts: { $gte: 5 },
        otp_locked_until: { $exists: false },
      },
      {
        $set: { otp_locked_until: new Date(now.getTime() + 15 * 60 * 1000) },
        $unset: { otp: 1, otp_expires: 1 },
      }
    );
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  if (!user.otp || !user.otp_expires || user.otp_expires <= now ||
      (user.otp_locked_until && user.otp_locked_until > now)) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  // Reserve one of five attempts atomically before comparing the supplied code.
  // This prevents concurrent requests and distributed IPs from bypassing the account limit.
  const reservation = await User.findOneAndUpdate(
    {
      _id: user._id,
      otp: user.otp,
      otp_expires: { $gt: now },
      $and: [
        { $or: [{ otp_locked_until: { $exists: false } }, { otp_locked_until: { $lte: now } }] },
        { $or: [{ otp_attempts: { $lt: 5 } }, { otp_attempts: { $exists: false } }] },
      ],
    },
    { $inc: { otp_attempts: 1 } },
    { new: true }
  ).select('+otp +otp_attempts +otp_expires');

  if (!reservation) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  if (!otpMatches(reservation.otp, otp)) {
    if (reservation.otp_attempts >= 5) {
      await User.updateOne(
        { _id: reservation._id, otp_attempts: { $gte: 5 } },
        {
          $unset: { otp: 1, otp_expires: 1 },
          $set: { otp_locked_until: new Date(Date.now() + 15 * 60 * 1000) },
        }
      );
    }
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  // Consume the OTP and update the password in one conditional write.
  // A concurrent request cannot reuse a code already consumed or invalidated.
  const passwordHash = await bcrypt.hash(new_password, 12);
  const result = await User.updateOne(
    {
      _id: reservation._id,
      otp: reservation.otp,
      otp_attempts: { $lte: 5 },
      $or: [{ otp_locked_until: { $exists: false } }, { otp_locked_until: { $lte: new Date() } }],
    },
    {
      $set: { password: passwordHash, otp_attempts: 0 },
      $unset: { otp: 1, otp_expires: 1, otp_locked_until: 1 },
    }
  );

  if (!result.matchedCount)
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  res.json({ success: true, message: 'Password reset successfully! You can now login.' });
};

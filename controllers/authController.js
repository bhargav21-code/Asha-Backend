const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });

  const user = await User.findOne({ username }).select('+password');
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  if (!user.active)
    return res.status(403).json({ success: false, message: 'Account deactivated' });

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

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.register = async (req, res) => {
  // Admin-only route to create users
  const { name, username, password, role, assigned_villages, phone } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ success: false, message: 'Username already taken' });

  const user = await User.create({ name, username, password, role, assigned_villages, phone });
  res.status(201).json({ success: true, user });
};

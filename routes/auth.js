const express = require('express');
const rateLimit = require('express-rate-limit');
const router  = express.Router();
const {
  login, getMe, register, selfRegister, requestChange,
  forgotPassword, verifyOTP,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post('/login',         loginLimiter, login);
router.post('/self-register', selfRegister);                          // public
router.get ('/me',            protect, getMe);
router.post('/register',      protect, authorize('Admin'), register); // admin only
router.post('/request-change', protect, requestChange);               // logged-in ASHA
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/verify-otp',      otpLimiter, verifyOTP);

module.exports = router;

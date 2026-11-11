
const express = require('express');
const router = express.Router();

const {
  login,
  getMe,
  register,
  selfRegister,
  requestChange,
  forgotPassword,
  verifyOTP,
} = require('../controllers/authController');

const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const {
  loginLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
  selfRegisterLimiter,
} = require('../middleware/rateLimiters');

router.post('/login', loginLimiter, login);
router.post('/self-register', selfRegisterLimiter, selfRegister);
router.get('/me', protect, getMe);
router.post('/register', protect, authorize('Admin'), register);
router.post('/request-change', protect, asyncHandler(requestChange));
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/verify-otp', verifyOtpLimiter, asyncHandler(verifyOTP));

module.exports = router;

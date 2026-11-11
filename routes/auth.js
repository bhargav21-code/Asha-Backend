
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

router.post('/login', loginLimiter, asyncHandler(login));
router.post('/self-register', selfRegisterLimiter, asyncHandler(selfRegister));
router.get('/me', protect, asyncHandler(getMe));
router.post('/register', protect, authorize('Admin'), asyncHandler(register));
router.post('/request-change', protect, asyncHandler(requestChange));
router.post('/forgot-password', forgotPasswordLimiter, asyncHandler(forgotPassword));
router.post('/verify-otp', verifyOtpLimiter, asyncHandler(verifyOTP));

module.exports = router;

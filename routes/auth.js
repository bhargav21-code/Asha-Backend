const express = require('express');
const router  = express.Router();
const {
  login, getMe, register, selfRegister, requestChange,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login',         login);
router.post('/self-register', selfRegister);                          // public
router.get ('/me',            protect, getMe);
router.post('/register',      protect, authorize('Admin'), register); // admin only
router.post('/request-change', protect, requestChange);               // logged-in ASHA

module.exports = router;

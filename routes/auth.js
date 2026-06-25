// routes/auth.js
const express = require('express');
const router = express.Router();
const { login, getMe, register } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/register', protect, authorize('Admin'), register);

module.exports = router;

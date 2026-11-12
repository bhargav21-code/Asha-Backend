const express = require('express');
const router = express.Router();
const { getDashboardSummary, submitDailyReport, getDailyReports } = require('../controllers/ashaController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/dashboard-summary', asyncHandler(getDashboardSummary));
router.post('/daily-report', asyncHandler(submitDailyReport));
router.get('/daily-reports', asyncHandler(getDailyReports));

module.exports = router;

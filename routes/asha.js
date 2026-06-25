const express = require('express');
const router = express.Router();
const { getDashboardSummary, submitDailyReport, getDailyReports } = require('../controllers/ashaController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/dashboard-summary', getDashboardSummary);
router.post('/daily-report', submitDailyReport);
router.get('/daily-reports', getDailyReports);

module.exports = router;

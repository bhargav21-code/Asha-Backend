const express = require('express');
const router = express.Router();
const {
  getMetrics,
  getVillageWiseAnalytics,
  getHighRiskList,
  getAllASHA,
  createASHA,
  getDailyReportsDashboard,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Admin'));
router.get('/metrics',              getMetrics);
router.get('/village-analytics',    getVillageWiseAnalytics);
router.get('/high-risk',            getHighRiskList);
router.get('/asha-workers',         getAllASHA);
router.post('/asha-workers',        createASHA);
router.get('/daily-reports-dashboard', getDailyReportsDashboard);

module.exports = router;

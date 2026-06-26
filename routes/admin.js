const express = require('express');
const router  = express.Router();
const {
  getMetrics, getVillageWiseAnalytics, getHighRiskList,
  getAllASHA, createASHA, getDailyReportsDashboard,
  // User Management
  getAllUsers, getPendingRegistrations, approveRegistration,
  createAdmin, editUser, toggleUserActive,
  resetUserPassword, deleteUser,
  getChangeRequests, handleChangeRequest,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('Admin'));

// Dashboard / analytics
router.get('/metrics',                   getMetrics);
router.get('/village-analytics',         getVillageWiseAnalytics);
router.get('/high-risk',                 getHighRiskList);
router.get('/daily-reports-dashboard',   getDailyReportsDashboard);

// ASHA workers (legacy)
router.get ('/asha-workers',             getAllASHA);
router.post('/asha-workers',             createASHA);

// ── User Management ──────────────────────────────────────────
router.get ('/users',                          getAllUsers);
router.get ('/users/pending',                  getPendingRegistrations);
router.patch('/users/:id/approve',             approveRegistration);
router.post ('/users/admin',                   createAdmin);
router.put  ('/users/:id',                     editUser);
router.patch('/users/:id/toggle-active',       toggleUserActive);
router.patch('/users/:id/reset-password',      resetUserPassword);
router.delete('/users/:id',                    deleteUser);
router.get  ('/users/change-requests',         getChangeRequests);
router.patch('/users/:id/change-request',      handleChangeRequest);

module.exports = router;

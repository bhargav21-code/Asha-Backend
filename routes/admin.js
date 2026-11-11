const express = require('express');
const router = express.Router();
const {
  getMetrics, getVillageWiseAnalytics, getHighRiskList,
  getAllASHA, createASHA, getDailyReportsDashboard,
  getAllUsers, getPendingRegistrations, approveRegistration,
  createAdmin, editUser, toggleUserActive,
  resetUserPassword, deleteUser,
  getChangeRequests, handleChangeRequest,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect, authorize('Admin'));

router.get('/metrics', asyncHandler(getMetrics));
router.get('/village-analytics', asyncHandler(getVillageWiseAnalytics));
router.get('/high-risk', asyncHandler(getHighRiskList));
router.get('/daily-reports-dashboard', asyncHandler(getDailyReportsDashboard));
router.get('/asha-workers', asyncHandler(getAllASHA));
router.post('/asha-workers', asyncHandler(createASHA));
router.get('/users', asyncHandler(getAllUsers));
router.get('/users/pending', asyncHandler(getPendingRegistrations));
router.patch('/users/:id/approve', asyncHandler(approveRegistration));
router.post('/users/admin', asyncHandler(createAdmin));
router.put('/users/:id', asyncHandler(editUser));
router.patch('/users/:id/toggle-active', asyncHandler(toggleUserActive));
router.patch('/users/:id/reset-password', asyncHandler(resetUserPassword));
router.delete('/users/:id', asyncHandler(deleteUser));
router.get('/users/change-requests', asyncHandler(getChangeRequests));
router.patch('/users/:id/change-request', asyncHandler(handleChangeRequest));

module.exports = router;

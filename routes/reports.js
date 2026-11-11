const express = require('express');
const router = express.Router();
const { getReports, createReport } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/', asyncHandler(getReports));
router.post('/', asyncHandler(createReport));

module.exports = router;

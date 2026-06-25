const express = require('express');
const router = express.Router();
const { getReports, createReport } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
router.use(protect);
router.get('/', getReports);
router.post('/', createReport);
module.exports = router;

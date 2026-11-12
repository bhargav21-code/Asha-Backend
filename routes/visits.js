const express = require('express');
const router = express.Router();
const { getAllVisits, createVisit, getVisit } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/', asyncHandler(getAllVisits));
router.post('/new', asyncHandler(createVisit));
router.get('/:id', asyncHandler(getVisit));

module.exports = router;

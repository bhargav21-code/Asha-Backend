const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove, addVisitHistory, getCalendar } = require('../controllers/followUpController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/calendar', asyncHandler(getCalendar));
router.get('/', asyncHandler(getAll));
router.post('/', asyncHandler(create));
router.get('/:id', asyncHandler(getOne));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));
router.post('/:id/history', asyncHandler(addVisitHistory));

module.exports = router;

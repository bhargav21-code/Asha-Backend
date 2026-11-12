const express = require('express');
const router = express.Router();
const {
  getAll, getOne, create, update, addChild, updateChild, markAttendance, remove,
} = require('../controllers/anganwadiController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/', asyncHandler(getAll));
router.post('/', asyncHandler(create));
router.get('/:id', asyncHandler(getOne));
router.put('/:id', asyncHandler(update));
router.delete('/:id', asyncHandler(remove));
router.post('/:id/children', asyncHandler(addChild));
router.patch('/:id/children/:childId', asyncHandler(updateChild));
router.put('/:id/mark-attendance', asyncHandler(markAttendance));

module.exports = router;

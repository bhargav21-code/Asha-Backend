const express = require('express');
const router = express.Router();
const { getAllFamilies, getFamily, createFamily, updateFamily } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/', asyncHandler(getAllFamilies));
router.post('/', asyncHandler(createFamily));
router.get('/:id', asyncHandler(getFamily));
router.put('/:id', asyncHandler(updateFamily));

module.exports = router;

const express = require('express');
const router = express.Router();
const { getAllChildren, getChild, createChild, updateChild } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(protect);
router.get('/', asyncHandler(getAllChildren));
router.post('/', asyncHandler(createChild));
router.get('/:id', asyncHandler(getChild));
router.put('/:id', asyncHandler(updateChild));

module.exports = router;

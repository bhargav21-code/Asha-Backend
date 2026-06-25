// routes/families.js
const express = require('express');
const router = express.Router();
const { getAllFamilies, getFamily, createFamily, updateFamily } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
router.use(protect);
router.get('/', getAllFamilies);
router.post('/', createFamily);
router.get('/:id', getFamily);
router.put('/:id', updateFamily);
module.exports = router;

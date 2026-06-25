// routes/visits.js
const express = require('express');
const router = express.Router();
const { getAllVisits, createVisit, getVisit } = require('../controllers/crudController');
const { protect } = require('../middleware/auth');
router.use(protect);
router.get('/', getAllVisits);
router.post('/new', createVisit);
router.get('/:id', getVisit);
module.exports = router;

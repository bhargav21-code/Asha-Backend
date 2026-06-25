const express = require('express');
const router  = express.Router();
const { getAll, getOne, create, update, remove, addVisitHistory, getCalendar } = require('../controllers/followUpController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/calendar',       getCalendar);
router.get('/',               getAll);
router.post('/',              create);
router.get('/:id',            getOne);
router.put('/:id',            update);
router.delete('/:id',         remove);
router.post('/:id/history',   addVisitHistory);

module.exports = router;

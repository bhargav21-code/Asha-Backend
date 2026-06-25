const express = require('express');
const router = express.Router();
const {
  getAll,
  getOne,
  create,
  update,
  addChild,
  markAttendance,
  remove,
} = require('../controllers/anganwadiController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',    getAll);
router.post('/',   create);
router.get('/:id',    getOne);
router.put('/:id',    update);
router.delete('/:id', remove);
router.post('/:id/children',         addChild);
router.put('/:id/mark-attendance',   markAttendance);

module.exports = router;

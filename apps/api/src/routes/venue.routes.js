const router = require('express').Router();
const ctrl = require('../controllers/venue.controller');

router.get('/',              ctrl.list);
router.get('/:id/courts',   ctrl.getCourts);

module.exports = router;

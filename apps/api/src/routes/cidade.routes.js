const router = require('express').Router();
const ctrl = require('../controllers/cidade.controller');

router.get('/',    ctrl.list);
router.get('/:id', ctrl.getById);

module.exports = router;

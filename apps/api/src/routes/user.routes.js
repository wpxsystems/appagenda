const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/user.controller');

router.use(auth);
router.get('/:id', ctrl.getPublicProfile);

module.exports = router;

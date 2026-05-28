const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/auth.controller');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/logout', auth, ctrl.logout);

module.exports = router;

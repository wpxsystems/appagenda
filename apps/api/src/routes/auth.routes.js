const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/auth.controller');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middlewares/loginRateLimit');

router.post('/register', registerLimiter, ctrl.register);
router.post('/login',    loginLimiter,    ctrl.login);
router.post('/refresh',  refreshLimiter,  ctrl.refresh);
router.post('/logout',   auth,            ctrl.logout);

module.exports = router;

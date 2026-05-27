const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/me', require('./me.routes'));
router.use('/cidades', require('./cidade.routes'));
router.use('/venues', require('./venue.routes'));
router.use('/jogos', require('./jogo.routes'));
router.use('/community', require('./community.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;

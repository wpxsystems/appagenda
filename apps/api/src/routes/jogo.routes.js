const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/jogo.controller');

router.get('/',                  ctrl.list);
router.get('/:id',         auth, ctrl.getById);
router.post('/',           auth, ctrl.create);
router.post('/:id/join',   auth, ctrl.join);
router.post('/:id/cancel', auth, ctrl.cancel);
router.get('/:id/messages',       auth, ctrl.getMessages);
router.post('/:id/messages',      auth, ctrl.createMessage);

module.exports = router;

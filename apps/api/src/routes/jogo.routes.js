const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/jogo.controller');
const ratingCtrl = require('../controllers/rating.controller');

router.get('/',                  ctrl.list);
router.get('/:id',         auth, ctrl.getById);
router.post('/',           auth, ctrl.create);
router.post('/:id/join',   auth, ctrl.join);
router.post('/:id/cancel',  auth, ctrl.cancel);
router.post('/:id/confirm', auth, ctrl.confirm);
router.post('/:id/leave',   auth, ctrl.leave);
router.get('/:id/messages',       auth, ctrl.getMessages);
router.post('/:id/messages',      auth, ctrl.createMessage);
router.post('/:id/ratings',       auth, ratingCtrl.submitRatings);
router.get('/:id/ratings/me',     auth, ratingCtrl.getMyRating);

module.exports = router;

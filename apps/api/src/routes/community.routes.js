const router = require('express').Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/community.controller');

router.use(auth);

router.get('/groups',                       ctrl.listGroups);
router.post('/groups',                      ctrl.createGroup);
router.get('/groups/:id',                   ctrl.getGroup);
router.delete('/groups/:id',                ctrl.deleteGroup);
router.get('/groups/:id/messages',          ctrl.getMessages);
router.post('/groups/:id/messages',         ctrl.createMessage);
router.post('/groups/:id/join',             ctrl.joinGroup);
router.delete('/groups/:id/leave',          ctrl.leaveGroup);
router.get('/favorites',                    ctrl.getFavorites);
router.post('/favorites/:targetId',         ctrl.addFavorite);
router.delete('/favorites/:targetId',       ctrl.removeFavorite);

module.exports = router;

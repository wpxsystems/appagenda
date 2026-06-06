const router = require('express').Router();
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const ctrl = require('../controllers/me.controller');

router.use(auth);

router.get('/',                      ctrl.getMe);
router.patch('/',                    ctrl.updateMe);
router.get('/availability',          ctrl.getAvailability);
router.patch('/availability',        ctrl.updateAvailability);
router.get('/sport-profiles',        ctrl.getSportProfiles);
router.post('/sport-profiles',       ctrl.createSportProfile);
router.patch('/sport-profiles/:sport', ctrl.updateSportProfile);
router.get('/location',              ctrl.getLocation);
router.patch('/location',            ctrl.updateLocation);
router.post('/avatar',               upload.single('avatar'), ctrl.uploadAvatar);
router.get('/jogos',                 ctrl.getMyGames);

module.exports = router;

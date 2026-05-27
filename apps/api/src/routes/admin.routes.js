const router = require('express').Router();
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const ctrl = require('../controllers/admin.controller');

router.use(auth, requireRole('admin', 'superadmin'));

router.get('/cidades',                   ctrl.listCidades);
router.post('/cidades',                  ctrl.createCidade);
router.patch('/cidades/:id',             ctrl.updateCidade);

router.get('/venues',                    ctrl.listVenues);
router.post('/venues',                   ctrl.createVenue);
router.patch('/venues/:id',              ctrl.updateVenue);

router.get('/venues/:venueId/courts',    ctrl.listCourts);
router.post('/venues/:venueId/courts',   ctrl.createCourt);
router.patch('/courts/:id',              ctrl.updateCourt);

module.exports = router;

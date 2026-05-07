// src/routes/admin.routes.js
const router        = require('express').Router();
const ctrl          = require('../controllers/admin.controller');
const zoneCtrl      = require('../controllers/zone.controller');
const localiteCtrl  = require('../controllers/localite.controller');
const paysCtrl      = require('../controllers/pays.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.use(protect, adminOnly); // toutes ces routes : JWT + rôle admin

router.get('/stats',              ctrl.getStats);         // GET  /api/admin/stats
router.get('/users',              ctrl.getAllUsers);       // GET  /api/admin/users
router.get('/users/:id',          ctrl.getUserById);      // GET  /api/admin/users/:id
router.put('/users/:id/toggle',   ctrl.toggleUserActive); // PUT  /api/admin/users/:id/toggle
router.delete('/users/:id',       ctrl.deleteUser);       // DELETE /api/admin/users/:id

// ── Zones ──────────────────────────────────────────────────────────────────────
router.get('/zones',           zoneCtrl.getAll);       // GET    /api/admin/zones
router.post('/zones',          zoneCtrl.create);       // POST   /api/admin/zones
router.post('/zones/bulk',     zoneCtrl.importBulk);   // POST   /api/admin/zones/bulk
router.delete('/zones/:id',    zoneCtrl.remove);       // DELETE /api/admin/zones/:id

// ── Localités Tunisia ──────────────────────────────────────────────────────────
router.post('/localites/import', localiteCtrl.importTunisia); // POST /api/admin/localites/import

// ── Pays (Algeria, France, Germany, Italy, Spain) ─────────────────────────────
router.post('/pays/import', paysCtrl.importAll); // POST /api/admin/pays/import

module.exports = router;

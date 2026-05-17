// src/routes/publication.routes.js
const router  = require('express').Router();
const ctrl    = require('../controllers/publication.controller');
const { protect }          = require('../middleware/auth.middleware');
const { upload }           = require('../middleware/upload.middleware');

// ─── Routes publiques ──────────────────────────────────────────────────────────
router.get('/',          ctrl.getAll);              // GET  /api/publications          — liste
router.get('/zone-dots', ctrl.getZoneDots);        // GET  /api/publications/zone-dots — carte (léger)
router.get('/by-zone',   ctrl.getByZone);          // GET  /api/publications/by-zone   — tous par zone
router.get('/mes',       protect, ctrl.getMes);    // GET  /api/publications/mes       — mes pubs
router.get('/:id',  ctrl.getOne);   // GET  /api/publications/:id      — détail

// ─── Routes protégées (JWT requis) ────────────────────────────────────────────

// Créer une publication avec jusqu'à 10 médias
router.post(
  '/',
  protect,
  upload.array('medias', 10),
  ctrl.create
);

// Modifier
router.put('/:id',  protect, ctrl.update);

// Supprimer
router.delete('/:id', protect, ctrl.remove);

// Renouveler (boost — coûte 1 post gratuit ou 10 points)
router.post('/:id/renew', protect, ctrl.renew);

// Like / Unlike
router.post('/:id/like', protect, ctrl.toggleLike);

// Noter (1-5 étoiles)
router.post('/:id/rate', protect, ctrl.rate);

module.exports = router;

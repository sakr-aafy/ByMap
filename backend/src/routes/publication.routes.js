// src/routes/publication.routes.js
const router  = require('express').Router();
const ctrl    = require('../controllers/publication.controller');
const { protect }          = require('../middleware/auth.middleware');
const { upload }           = require('../middleware/upload.middleware');

// ─── Routes publiques ──────────────────────────────────────────────────────────
router.get('/',     ctrl.getAll);   // GET  /api/publications          — liste
router.get('/mes',  protect, ctrl.getMes);  // GET  /api/publications/mes  — mes pubs
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

// Like / Unlike
router.post('/:id/like', protect, ctrl.toggleLike);

// Renouveler (+24h)
router.post('/:id/renew', protect, ctrl.renew);

module.exports = router;

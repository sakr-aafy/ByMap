// src/routes/favorite.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/favorite.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/',              ctrl.list);    // GET  /api/favorites
router.get('/check',         ctrl.check);  // GET  /api/favorites/check?zoneName=X
router.post('/toggle',       ctrl.toggle); // POST /api/favorites/toggle

module.exports = router;

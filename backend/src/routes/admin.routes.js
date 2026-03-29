// src/routes/admin.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.use(protect, adminOnly); // toutes ces routes : JWT + rôle admin

router.get('/stats',              ctrl.getStats);         // GET  /api/admin/stats
router.get('/users',              ctrl.getAllUsers);       // GET  /api/admin/users
router.get('/users/:id',          ctrl.getUserById);      // GET  /api/admin/users/:id
router.put('/users/:id/toggle',   ctrl.toggleUserActive); // PUT  /api/admin/users/:id/toggle
router.delete('/users/:id',       ctrl.deleteUser);       // DELETE /api/admin/users/:id

module.exports = router;

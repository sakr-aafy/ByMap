const router = require('express').Router();
const ctrl   = require('../controllers/zone.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

// Public — carte peut fetch les zones
router.get('/', ctrl.getAll);

// Admin only
router.post('/',      protect, adminOnly, ctrl.create);
router.delete('/:id', protect, adminOnly, ctrl.remove);

module.exports = router;

const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getStats,
} = require('../controllers/adminController');

const router = express.Router();

// Toutes les routes admin nécessitent un JWT valide + rôle admin
router.use(protect, adminOnly);

router.get('/stats',       getStats);
router.get('/users',       getAllUsers);
router.get('/users/:id',   getUserById);
router.patch('/users/:id', updateUser);
router.delete('/users/:id',deleteUser);

module.exports = router;

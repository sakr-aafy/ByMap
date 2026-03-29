// src/routes/auth.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public
router.post('/register',            ctrl.register);
router.post('/verify-email',        ctrl.verifyEmail);
router.post('/resend-verification', ctrl.resendVerification);
router.post('/login',               ctrl.login);
router.post('/refresh',             ctrl.refresh);

// Protégée
router.post('/logout', protect, ctrl.logout);

module.exports = router;

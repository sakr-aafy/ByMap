// src/routes/auth.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.post('/refresh',  ctrl.refresh);
router.post('/social',   ctrl.socialLogin);
router.post('/logout',   protect, ctrl.logout);

// OTP — vérification e-mail à l'inscription
router.post('/send-register-otp',    ctrl.sendRegisterOtp);
router.post('/verify-register-otp',  ctrl.verifyRegisterOtp);

// OTP — réinitialisation de mot de passe
router.post('/forgot-password',   ctrl.forgotPassword);
router.post('/verify-reset-code', ctrl.verifyResetCode);
router.post('/reset-password',    ctrl.resetPassword);

module.exports = router;

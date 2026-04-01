// src/controllers/auth.controller.js
const jwt          = require('jsonwebtoken');
const User         = require('../models/User.model');
const emailService = require('../services/email.service');

// ─── Helpers JWT ──────────────────────────────────────────────────────────────
const signAccess = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET || 'bymap_secret', {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });

const signRefresh = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'bymap_refresh', {
    expiresIn: '30d',
  });

// ─── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, phone, password } = req.body;

    if (!password) return res.status(400).json({ message: 'Mot de passe requis' });
    if (!email && !phone)
      return res.status(400).json({ message: 'Email ou téléphone requis' });

    // Vérifier doublon
    const exists = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    });
    if (exists) {
      const field = exists.email === email ? 'Email' : 'Téléphone';
      return res.status(409).json({ message: `${field} déjà utilisé` });
    }

    // Générer le code de vérification si email fourni
    const code    = email ? emailService.generateCode() : null;
    const expires = email ? new Date(Date.now() + 10 * 60 * 1000) : null; // 10 min

    const user = await User.create({
      nom,
      prenom,
      email,
      phone,
      password,
      isEmailVerified:          email ? false : true, // pas de vérif si inscription par tel
      emailVerificationCode:    code,
      emailVerificationExpires: expires,
    });

    // Envoyer le code par email
    if (email && code) {
      await emailService.sendVerificationEmail(email, code);
    }

    res.status(201).json({
      message: email
        ? 'Compte créé. Vérifiez votre email pour activer votre compte.'
        : 'Compte créé avec succès.',
      emailVerificationRequired: !!email,
      user: { _id: user._id, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error('[REGISTER]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/verify-email ──────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code)
      return res.status(400).json({ message: 'Email et code requis' });

    const user = await User.findOne({ email }).select(
      '+emailVerificationCode +emailVerificationExpires'
    );

    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user.isEmailVerified)
      return res.status(400).json({ message: 'Email déjà vérifié' });

    if (!user.emailVerificationCode || !user.emailVerificationExpires)
      return res.status(400).json({ message: 'Aucun code en attente' });

    if (user.emailVerificationExpires < new Date())
      return res.status(400).json({ message: 'Code expiré. Demandez-en un nouveau.' });

    if (user.emailVerificationCode !== code)
      return res.status(400).json({ message: 'Code incorrect' });

    // Marquer comme vérifié et effacer le code (null = suppression réelle en BDD)
    user.isEmailVerified          = true;
    user.emailVerificationCode    = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });

    // Générer les tokens et connecter directement
    const accessToken  = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Email vérifié avec succès',
      accessToken,
      refreshToken,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error('[VERIFY-EMAIL]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/resend-verification ──────────────────────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email requis' });

    const user = await User.findOne({ email }).select(
      '+emailVerificationCode +emailVerificationExpires'
    );

    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user.isEmailVerified)
      return res.status(400).json({ message: 'Email déjà vérifié' });

    // Limiter le renvoi : attendre au moins 1 minute
    if (
      user.emailVerificationExpires &&
      user.emailVerificationExpires > new Date(Date.now() + 9 * 60 * 1000)
    ) {
      return res.status(429).json({
        message: 'Veuillez attendre 1 minute avant de renvoyer le code.',
      });
    }

    const code    = emailService.generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerificationCode    = code;
    user.emailVerificationExpires = expires;
    await user.save({ validateBeforeSave: false });

    await emailService.sendVerificationEmail(email, code);

    res.json({ message: 'Code de vérification renvoyé' });
  } catch (err) {
    console.error('[RESEND-VERIFICATION]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!password) return res.status(400).json({ message: 'Mot de passe requis' });
    if (!email && !phone)
      return res.status(400).json({ message: 'Email ou téléphone requis' });

    // ── Connexion admin (credentials fixes depuis .env) ──────────────────────
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin';
    const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      let admin = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });

      if (!admin) {
        admin = await User.create({
          nom: 'Admin',
          prenom: 'ByMap',
          email: ADMIN_EMAIL,
          password: ADMIN_PASS,
          role: 'admin',
          isEmailVerified: true,
        });
      }

      const accessToken  = signAccess(admin._id, 'admin');
      const refreshToken = signRefresh(admin._id);
      admin.refreshToken = refreshToken;
      admin.lastLogin    = new Date();
      await admin.save({ validateBeforeSave: false });

      return res.json({
        message: 'Connexion admin réussie',
        accessToken,
        refreshToken,
        user: { ...admin.toPublic(), role: 'admin' },
      });
    }

    // ── Connexion utilisateur normal ─────────────────────────────────────────
    const query = email ? { email } : { phone };
    const user  = await User.findOne(query).select(
      '+password +emailVerificationCode +emailVerificationExpires'
    );

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (!user.isActive) return res.status(403).json({ message: 'Compte désactivé' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Mot de passe incorrect' });

    // Bloquer si email non vérifié
    if (email && !user.isEmailVerified) {
      const codeExpired =
        !user.emailVerificationCode ||
        !user.emailVerificationExpires ||
        user.emailVerificationExpires < new Date();

      if (codeExpired) {
        const newCode    = emailService.generateCode();
        const newExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.emailVerificationCode    = newCode;
        user.emailVerificationExpires = newExpires;
        await user.save({ validateBeforeSave: false });
        await emailService.sendVerificationEmail(user.email, newCode);
      }

      return res.status(403).json({
        message: codeExpired
          ? 'Code expiré. Un nouveau code a été envoyé.'
          : 'Email non vérifié. Vérifiez votre boîte mail.',
        emailVerificationRequired: true,
        codeSent: codeExpired,
        email: user.email,
      });
    }

    // ── Si l'utilisateur a un email → envoyer OTP de connexion ──────────────
    if (user.email) {
      const otp     = emailService.generateCode();
      const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 min
      user.loginOtpCode    = otp;
      user.loginOtpExpires = expires;
      await user.save({ validateBeforeSave: false });
      await emailService.sendLoginOtpEmail(user.email, otp);

      return res.json({
        message:          'Code de vérification envoyé par email',
        loginOtpRequired: true,
        email:            user.email,
      });
    }

    // ── Pas d'email (téléphone uniquement) → connexion directe ───────────────
    const accessToken  = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error('[LOGIN]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ message: 'Token manquant' });

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'bymap_refresh'
    );

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken)
      return res.status(403).json({ message: 'Token invalide' });

    const newAccess  = signAccess(user._id, user.role);
    const newRefresh = signRefresh(user._id);

    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    res.status(403).json({ message: 'Token expiré ou invalide' });
  }
};

// ─── POST /api/auth/verify-login-otp ─────────────────────────────────────────
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res.status(400).json({ message: 'Email et code requis' });

    const user = await User.findOne({ email }).select('+loginOtpCode +loginOtpExpires');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (!user.loginOtpCode || !user.loginOtpExpires)
      return res.status(400).json({ message: 'Aucun code en attente' });

    if (user.loginOtpExpires < new Date())
      return res.status(400).json({ message: 'Code expiré. Reconnectez-vous.' });

    if (user.loginOtpCode !== code)
      return res.status(400).json({ message: 'Code incorrect' });

    // Effacer l'OTP et générer les tokens
    user.loginOtpCode    = null;
    user.loginOtpExpires = null;
    const accessToken    = signAccess(user._id, user.role);
    const refreshToken   = signRefresh(user._id);
    user.refreshToken    = refreshToken;
    user.lastLogin       = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error('[VERIFY-LOGIN-OTP]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Aucun compte avec cet email' });

    const code    = emailService.generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.passwordResetCode    = code;
    user.passwordResetExpires = expires;
    await user.save({ validateBeforeSave: false });

    await emailService.sendPasswordResetEmail(email, code);

    res.json({ message: 'Code de réinitialisation envoyé par email' });
  } catch (err) {
    console.error('[FORGOT-PASSWORD]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: 'Email, code et nouveau mot de passe requis' });

    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });

    const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpires');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (!user.passwordResetCode || !user.passwordResetExpires)
      return res.status(400).json({ message: 'Aucune demande de réinitialisation en cours' });

    if (user.passwordResetExpires < new Date())
      return res.status(400).json({ message: 'Code expiré. Faites une nouvelle demande.' });

    if (user.passwordResetCode !== code)
      return res.status(400).json({ message: 'Code incorrect' });

    user.password             = newPassword;
    user.passwordResetCode    = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('[RESET-PASSWORD]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// src/controllers/auth.controller.js
const jwt  = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User.model');
const Otp  = require('../models/Otp.model');
const { sendOtpEmail } = require('../utils/email');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── Helper : fetch HTTPS simple ─────────────────────────────────────────────
const fetchJSON = (url) => new Promise((resolve, reject) => {
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try { resolve({ ok: res.statusCode < 400, data: JSON.parse(data) }); }
      catch { reject(new Error('JSON parse error')); }
    });
  }).on('error', reject);
});

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

    const user = await User.create({ nom, prenom, email, phone, password });

    const accessToken  = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      message: 'Compte créé avec succès',
      accessToken,
      refreshToken,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error('[REGISTER]', err);
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

    // ── Admin ─────────────────────────────────────────────────────────────────
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin';
    const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      let admin = await User.findOne({ email: ADMIN_EMAIL, role: 'admin' });
      if (!admin) {
        admin = await User.create({
          nom: 'Admin', prenom: 'ByMap',
          email: ADMIN_EMAIL, password: ADMIN_PASS,
          role: 'admin',
        });
      }
      const accessToken  = signAccess(admin._id, 'admin');
      const refreshToken = signRefresh(admin._id);
      admin.refreshToken = refreshToken;
      admin.lastLogin    = new Date();
      await admin.save({ validateBeforeSave: false });
      return res.json({
        message: 'Connexion admin réussie',
        accessToken, refreshToken,
        user: { ...admin.toPublic(), role: 'admin' },
      });
    }

    // ── Utilisateur normal ────────────────────────────────────────────────────
    const user = await User.findOne(email ? { email } : { phone }).select('+password');
    if (!user)    return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (!user.isActive) return res.status(403).json({ message: 'Compte désactivé' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Mot de passe incorrect' });

    const accessToken  = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Connexion réussie', accessToken, refreshToken, user: user.toPublic() });
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

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'bymap_refresh');
    const user    = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== refreshToken)
      return res.status(403).json({ message: 'Token invalide' });

    const newAccess  = signAccess(user._id, user.role);
    const newRefresh = signRefresh(user._id);
    user.refreshToken = newRefresh;
    await user.save({ validateBeforeSave: false });

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(403).json({ message: 'Token expiré ou invalide' });
  }
};

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: 'Déconnexion réussie' });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/auth/social ────────────────────────────────────────────────────
exports.socialLogin = async (req, res) => {
  try {
    const { provider, token, name = '', email = '' } = req.body;
    if (!provider || !token)
      return res.status(400).json({ message: 'provider et token requis' });

    let socialId, verifiedEmail, verifiedName;

    if (provider === 'google') {
      const { ok, data } = await fetchJSON(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      if (!ok || !data.sub) return res.status(401).json({ message: 'Token Google invalide' });
      socialId = data.sub; verifiedEmail = data.email; verifiedName = data.name || name;

    } else if (provider === 'facebook') {
      const { ok, data } = await fetchJSON(`https://graph.facebook.com/me?access_token=${token}&fields=id,name,email`);
      if (!ok || data.error || !data.id) return res.status(401).json({ message: 'Token Facebook invalide' });
      socialId = data.id; verifiedEmail = data.email || email; verifiedName = data.name || name;

    } else if (provider === 'apple') {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.sub) return res.status(401).json({ message: 'Token Apple invalide' });
      socialId = decoded.sub; verifiedEmail = decoded.email || email; verifiedName = name;

    } else {
      return res.status(400).json({ message: 'Provider non supporté' });
    }

    const idField = `${provider}Id`;
    let user = await User.findOne({ [idField]: socialId });
    if (!user && verifiedEmail) user = await User.findOne({ email: verifiedEmail.toLowerCase() });

    if (!user) {
      const parts = (verifiedName || '').trim().split(' ');
      user = await User.create({
        [idField]: socialId,
        email: verifiedEmail ? verifiedEmail.toLowerCase() : undefined,
        prenom: parts[0] || '', nom: parts.slice(1).join(' ') || '',
        isActive: true,
      });
    } else if (!user[idField]) {
      user[idField] = socialId;
      await user.save({ validateBeforeSave: false });
    }

    const accessToken  = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    user.lastLogin     = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ accessToken, refreshToken, user: user.toPublic() });
  } catch (err) {
    console.error('[SOCIAL LOGIN]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/auth/send-register-otp ────────────────────────────────────────
exports.sendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email déjà utilisé' });

    const code      = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ email: email.toLowerCase(), type: 'register' });
    await Otp.create({ email: email.toLowerCase(), code, type: 'register', expiresAt });
    await sendOtpEmail(email, code, 'register');

    res.json({ message: 'Code envoyé' });
  } catch (err) {
    console.error('[SEND_REGISTER_OTP]', err);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail" });
  }
};

// ─── POST /api/auth/verify-register-otp ──────────────────────────────────────
exports.verifyRegisterOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    const otp = await Otp.findOne({ email: email.toLowerCase(), type: 'register', code });
    if (!otp)                   return res.status(400).json({ message: 'Code invalide' });
    if (otp.expiresAt < Date.now()) return res.status(400).json({ message: 'Code expiré' });

    await otp.deleteOne();
    res.json({ message: 'Email vérifié' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Réponse identique que l'email existe ou non — évite l'énumération d'emails
    if (!user) return res.json({ message: 'Code de réinitialisation envoyé' });

    const code      = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.deleteMany({ email: email.toLowerCase(), type: 'reset' });
    await Otp.create({ email: email.toLowerCase(), code, type: 'reset', expiresAt });
    await sendOtpEmail(email, code, 'reset');

    res.json({ message: 'Code de réinitialisation envoyé' });
  } catch (err) {
    console.error('[FORGOT_PASSWORD]', err);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail" });
  }
};

// ─── POST /api/auth/verify-reset-code ────────────────────────────────────────
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const otp = await Otp.findOne({ email: email.toLowerCase(), type: 'reset', code });
    if (!otp)                       return res.status(400).json({ message: 'Code invalide' });
    if (otp.expiresAt < Date.now()) return res.status(400).json({ message: 'Code expiré' });

    res.json({ message: 'Code valide' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Mot de passe trop court (min. 6 caractères)' });

    const otp = await Otp.findOne({ email: email.toLowerCase(), type: 'reset', code });
    if (!otp)                       return res.status(400).json({ message: 'Code invalide' });
    if (otp.expiresAt < Date.now()) return res.status(400).json({ message: 'Code expiré' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    user.password = newPassword;
    await user.save();
    await otp.deleteOne();

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('[RESET_PASSWORD]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// src/routes/user.routes.js
// Toutes les routes du profil utilisateur (ProfileScreen vues 900 → 902)

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { protect: authenticate } = require('../middleware/auth.middleware');
const ctrl     = require('../controllers/profile.controller');

const router = express.Router();

// ── Configuration Multer (upload avatar) ─────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `avatar_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Format non supporté. Utilisez JPEG, PNG ou WEBP.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// ─────────────────────────────────────────────────────────────────────────────
// Toutes les routes ci-dessous nécessitent un JWT valide
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);

// ── Vue 900 — Profil principal ────────────────────────────────────────────────
// GET  /api/users/me          → Récupérer le profil
router.get('/me', ctrl.getMe);

// ── Vue 901 — Edit Profile ────────────────────────────────────────────────────
// PUT  /api/users/me          → Mettre à jour nom/prénom/email/phone/preferredZone
router.put('/me', ctrl.updateMe);

// PUT  /api/users/me/avatar   → Changer la photo de profil
router.put('/me/avatar', upload.single('avatar'), ctrl.updateAvatar);

// ── Vue 902 — Settings ────────────────────────────────────────────────────────
// GET  /api/users/me/settings → Lire les paramètres
router.get('/me/settings', ctrl.getSettings);

// PUT  /api/users/me/settings → Mettre à jour langue / notifications / location
router.put('/me/settings', ctrl.updateSettings);

// PUT  /api/users/me/password → Changer le mot de passe
router.put('/me/password', ctrl.changePassword);

// DELETE /api/users/me        → Supprimer le compte (soft-delete)
router.delete('/me', ctrl.deleteMe);

// ── Système de points ─────────────────────────────────────────────────────────
// POST /api/users/me/points/buy → Acheter des points (10 pts = 1 dinar)
router.post('/me/points/buy', ctrl.buyPoints);

// ── Vue 900 — My Ads ─────────────────────────────────────────────────────────
// GET  /api/users/me/ads      → Publications de l'utilisateur connecté
router.get('/me/ads', ctrl.getMyAds);

// ── Push token ────────────────────────────────────────────────────────────────
// PUT /api/users/push-token → Enregistrer le token Expo
router.put('/push-token', ctrl.savePushToken);

module.exports = router;
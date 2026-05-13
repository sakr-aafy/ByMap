// src/controllers/profile.controller.js
// Couvre toutes les actions du ProfileScreen (vues 900 → 903)

const bcrypt = require('bcryptjs');
const User   = require('../models/User.model');

// ─── PUT /api/users/push-token ────────────────────────────────────────────────
exports.savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token requis' });
    await User.findByIdAndUpdate(req.user.id, { pushToken: token });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/me
// Vue 900 — Récupérer le profil de l'utilisateur connecté
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    res.json({ user: user.toPublic() });
  } catch (err) {
    console.error('[getMe]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/me
// Vue 901 — Modifier le profil (nom, prénom, email, phone, preferredZone)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const { prenom, nom, email, phone, preferredZone } = req.body;

    // Champs autorisés à modifier (whitelist)
    const updates = {};
    if (prenom       !== undefined) updates.prenom       = prenom.trim();
    if (nom          !== undefined) updates.nom          = nom.trim();
    if (preferredZone !== undefined) updates.preferredZone = preferredZone.trim();

    // Email — vérifier unicité
    if (email !== undefined) {
      const emailLower = email.toLowerCase().trim();
      const exists = await User.findOne({ email: emailLower, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé' });
      }
      updates.email = emailLower;
    }

    // Phone — vérifier unicité
    if (phone !== undefined) {
      const phoneTrimmed = phone.trim();
      const exists = await User.findOne({ phone: phoneTrimmed, _id: { $ne: req.user.id } });
      if (exists) {
        return res.status(409).json({ message: 'Ce numéro est déjà utilisé' });
      }
      updates.phone = phoneTrimmed;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    res.json({ message: 'Profil mis à jour', user: user.toPublic() });
  } catch (err) {
    console.error('[updateMe]', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/me/avatar
// Vue 901 — Changer la photo de profil (upload multipart)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu' });
    }

    // req.file.path est rempli par multer (ex : uploads/avatars/abc.jpg)
    // En production remplacez par l'URL Cloudinary / S3
    const avatarUrl = `${process.env.BASE_URL || ''}/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatarUrl } },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    res.json({ message: 'Avatar mis à jour', avatarUrl, user: user.toPublic() });
  } catch (err) {
    console.error('[updateAvatar]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/me/settings
// Vue 902 — Lire les paramètres (langue, notifications, localisation)
// ─────────────────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings');
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    res.json({ settings: user.settings });
  } catch (err) {
    console.error('[getSettings]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/me/settings
// Vue 902 — Mettre à jour les paramètres
// ─────────────────────────────────────────────────────────────────────────────
exports.updateSettings = async (req, res) => {
  try {
    const { language, notifications, locationAccess } = req.body;

    const settingsUpdate = {};
    if (language       !== undefined) settingsUpdate['settings.language']       = language;
    if (notifications  !== undefined) settingsUpdate['settings.notifications']  = Boolean(notifications);
    if (locationAccess !== undefined) settingsUpdate['settings.locationAccess'] = Boolean(locationAccess);

    if (Object.keys(settingsUpdate).length === 0) {
      return res.status(400).json({ message: 'Aucun paramètre à mettre à jour' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: settingsUpdate },
      { new: true }
    ).select('settings');

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    res.json({ message: 'Paramètres mis à jour', settings: user.settings });
  } catch (err) {
    console.error('[updateSettings]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/me/password
// Vue 902 — Changer le mot de passe
// ─────────────────────────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Les deux mots de passe sont requis' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    // Récupérer le mot de passe (champ select:false)
    const user = await User.findById(req.user.id).select('+password');
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    user.password = newPassword; // le pre-save hook hache automatiquement
    await user.save();

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('[changePassword]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/users/me
// Vue 902 — Supprimer le compte (soft-delete)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Soft-delete : on marque sans effacer les données
    user.isDeleted  = true;
    user.deletedAt  = new Date();
    user.isActive   = false;
    user.refreshToken = null;
    await user.save();

    res.json({ message: 'Compte supprimé avec succès' });
  } catch (err) {
    console.error('[deleteMe]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/me/points/buy
// Acheter des points : 10 points = 1 dinar
// Body: { quantite: number }  — doit être un multiple de 10, minimum 10
// ─────────────────────────────────────────────────────────────────────────────
exports.buyPoints = async (req, res) => {
  try {
    const qty = Number(req.body.quantite);
    if (!qty || qty < 10 || qty % 10 !== 0) {
      return res.status(400).json({ message: 'Quantité invalide (multiple de 10, minimum 10 points)' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { pointsSolde: qty } },
      { new: true }
    ).select('-password -refreshToken');

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const cout = qty / 10;
    res.json({
      message: `${qty} points ajoutés pour ${cout} dinar(s)`,
      pointsSolde: user.pointsSolde,
      user: user.toPublic(),
    });
  } catch (err) {
    console.error('[buyPoints]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/me/ads
// Vue 900 — "My Ads" : publications de l'utilisateur connecté
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyAds = async (req, res) => {
  try {
    const Publication = require('../models/Publication.model');

    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { auteur: req.user.id, statut: { $ne: 'supprimee' } };

    const [publications, total] = await Promise.all([
      Publication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Publication.countDocuments(filter),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({
      publications,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('[getMyAds]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

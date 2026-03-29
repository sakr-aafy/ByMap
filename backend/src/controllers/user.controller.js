// src/controllers/user.controller.js
const User = require('../models/User.model');

// ─── GET /api/users/me ────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const { nom, prenom, avatarUrl } = req.body;
    // Empêcher la modification du rôle ou du mot de passe ici
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { nom, prenom, avatarUrl },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Profil mis à jour', user: updated.toPublic() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── PUT /api/users/me/password ───────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Champs requis manquants' });

    const user = await User.findById(req.user.id).select('+password');
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

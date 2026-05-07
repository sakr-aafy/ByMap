// src/middleware/auth.middleware.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User.model');

// ─── Vérifie le JWT et attache req.user ───────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ message: 'Non autorisé — token manquant' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bymap_secret');

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Utilisateur introuvable ou désactivé' });

    req.user = { id: user._id, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};

// ─── Restreint l'accès aux admins ────────────────────────────────────────────
exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  next();
};

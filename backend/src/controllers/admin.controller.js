// src/controllers/admin.controller.js
const User = require('../models/User.model');

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (role)   filter.role = role;
    if (search) filter.$or = [
      { nom:    { $regex: search, $options: 'i' } },
      { prenom: { $regex: search, $options: 'i' } },
      { email:  { $regex: search, $options: 'i' } },
      { phone:  { $regex: search, $options: 'i' } },
    ];

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      users: users.map((u) => u.toPublic()),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── PUT /api/admin/users/:id/toggle ─────────────────────────────────────────
exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ message: `Compte ${user.isActive ? 'activé' : 'désactivé'}`, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const Publication = require('../models/Publication.model');

    const [totalUsers, activeUsers, recentSignups, totalPublications, gouvernorats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      Publication.countDocuments(),
      Publication.distinct('localisation.gouvernorat'),
    ]);

    const lieux = gouvernorats.filter(g => g && g.trim()).length;

    res.json({ totalUsers, activeUsers, recentSignups, totalPublications, lieux });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

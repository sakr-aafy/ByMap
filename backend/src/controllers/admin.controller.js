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

// ─── PUT /api/admin/users/:id/add-points ─────────────────────────────────────
exports.addPoints = async (req, res) => {
  try {
    const points    = parseInt(req.body.points    ?? 0, 10);
    const freePosts = parseInt(req.body.freePosts ?? 0, 10);

    if (points < 0 || freePosts < 0)
      return res.status(400).json({ message: 'Les valeurs doivent être positives' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (points    > 0) user.pointsSolde        = (user.pointsSolde        || 0) + points;
    if (freePosts > 0) user.freePostsRemaining = (user.freePostsRemaining || 0) + freePosts;

    await user.save({ validateBeforeSave: false });

    // ── Push notification à l'utilisateur crédité ────────────────────────────
    if (user.pushToken) {
      const { sendPush } = require('../services/push.service');

      // Construire le titre et le corps selon ce qui a été crédité
      const parts = [];
      if (points    > 0) parts.push(`+${points} points`);
      if (freePosts > 0) parts.push(`+${freePosts} post${freePosts > 1 ? 's' : ''} gratuit${freePosts > 1 ? 's' : ''}`);

      const title = '🎁 Crédit reçu !';
      const body  = `${parts.join(' et ')} ont été ajoutés à votre compte.\n🪙 Solde : ${user.pointsSolde} pts  ·  📰 ${user.freePostsRemaining} posts gratuits`;

      sendPush(
        user.pushToken,
        title,
        body,
        { screen: 'Profile' }
      ).catch(() => {}); // fire-and-forget
    }

    res.json({ message: 'Solde mis à jour', user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET /api/admin/notifications ────────────────────────────────────────────
// Retourne les dernières créations de comptes (50 max)
exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? 50, 10), 100);
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('nom prenom email phone createdAt avatarUrl role pointsSolde freePostsRemaining');

    const notifications = users.map(u => ({
      _id:       u._id,
      type:      'new_account',
      nom:       u.nom,
      prenom:    u.prenom,
      email:     u.email || u.phone || '',
      avatarUrl: u.avatarUrl || '',
      role:      u.role,
      pointsSolde:        u.pointsSolde        ?? 100,
      freePostsRemaining: u.freePostsRemaining ?? 10,
      createdAt: u.createdAt,
    }));

    res.json({ notifications, total: notifications.length });
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

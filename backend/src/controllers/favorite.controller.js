// src/controllers/favorite.controller.js
const Favorite = require('../models/Favorite.model');

// GET /api/favorites — list user's favorites
exports.list = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const favorites = await Favorite.find({ user: userId }).sort({ createdAt: -1 });
    res.json(favorites);
  } catch (err) {
    console.error('[FAVORITE LIST]', err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/favorites/toggle — add or remove a favorite zone
exports.toggle = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Non autorisé' });

    const { zoneName, lat, lng } = req.body;
    if (!zoneName) return res.status(400).json({ message: 'zoneName requis' });

    const existing = await Favorite.findOne({ user: userId, zoneName });
    if (existing) {
      await existing.deleteOne();
      return res.json({ favorited: false, zoneName });
    }

    const fav = await Favorite.create({ user: userId, zoneName, lat: lat ?? undefined, lng: lng ?? undefined });
    res.status(201).json({ favorited: true, zoneName, favorite: fav });
  } catch (err) {
    console.error('[FAVORITE TOGGLE]', err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/favorites/check?zoneName=X — check if a zone is favorited
exports.check = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const { zoneName } = req.query;
    if (!zoneName) return res.status(400).json({ message: 'zoneName requis' });
    const exists = await Favorite.exists({ user: userId, zoneName });
    res.json({ favorited: !!exists });
  } catch (err) {
    console.error('[FAVORITE CHECK]', err);
    res.status(500).json({ message: err.message });
  }
};

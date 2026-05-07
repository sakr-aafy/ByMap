// src/models/Favorite.model.js
const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    zoneName: {
      type: String,
      required: true,
      trim: true,
    },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
);

FavoriteSchema.index({ user: 1, zoneName: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', FavoriteSchema);

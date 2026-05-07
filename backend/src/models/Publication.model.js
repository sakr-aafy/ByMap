// src/models/Publication.model.js
const mongoose = require('mongoose');

// ─── Sous-schéma Média (photo ou vidéo) ──────────────────────────────────────
const MediaSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true },   // URL Cloudinary ou chemin local
    type:     { type: String, enum: ['image', 'video'], required: true },
    publicId: { type: String, default: '' },       // ID Cloudinary pour suppression
  },
  { _id: false }
);

// ─── Sous-schéma Localisation ─────────────────────────────────────────────────
const LocalisationSchema = new mongoose.Schema(
  {
    ville:       { type: String, trim: true, default: '' },
    gouvernorat: { type: String, trim: true, default: '' },
    delegation:  { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ─── Schéma principal Publication ─────────────────────────────────────────────
const PublicationSchema = new mongoose.Schema(
  {
    auteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Mode : publication locale (un point) ou duo (trajet A → B)
    mode: {
      type: String,
      enum: ['local', 'duo'],
      required: true,
      default: 'local',
    },

    description: {
      type: String,
      required: [true, 'La description est obligatoire'],
      trim: true,
      maxlength: [1000, 'Description trop longue (max 1000 caractères)'],
    },

    medias: {
      type: [MediaSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: 'Maximum 10 médias par publication',
      },
    },

    // Localisation locale (mode = 'local')
    localisation: {
      type: LocalisationSchema,
      default: () => ({}),
    },

    // Localisations duo (mode = 'duo')
    localisationDebut: {
      type: LocalisationSchema,
      default: () => ({}),
    },
    localisationFin: {
      type: LocalisationSchema,
      default: () => ({}),
    },

    statut: {
      type: String,
      enum: ['active', 'archivee', 'supprimee'],
      default: 'active',
    },

    vues:      { type: Number, default: 0 },
    likes:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    ratings:   [{
      user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      value: { type: Number, min: 1, max: 5, required: true },
      _id: false,
    }],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  {
    timestamps: true,              // createdAt, updatedAt
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
PublicationSchema.virtual('nbLikes').get(function () {
  return this.likes.length;
});

PublicationSchema.virtual('nbRatings').get(function () {
  return this.ratings ? this.ratings.length : 0;
});

PublicationSchema.virtual('avgRating').get(function () {
  if (!this.ratings || this.ratings.length === 0) return 0;
  const sum = this.ratings.reduce((acc, r) => acc + r.value, 0);
  return Math.round((sum / this.ratings.length) * 10) / 10;
});

// ─── Index pour les recherches fréquentes ─────────────────────────────────────
PublicationSchema.index({ auteur: 1, createdAt: -1 });
PublicationSchema.index({ statut: 1, createdAt: -1 });
PublicationSchema.index({ 'localisation.ville': 1 });
PublicationSchema.index({ mode: 1 });

module.exports = mongoose.model('Publication', PublicationSchema);

// src/models/User.model.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── Sous-schéma Settings (vue 902) ────────────────────────────────────────────
const SettingsSchema = new mongoose.Schema(
  {
    language:       { type: String, default: 'العربية' },
    notifications:  { type: Boolean, default: true },
    locationAccess: { type: Boolean, default: true },
  },
  { _id: false }
);

// ── Schéma principal User ─────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      trim: true,
      default: '',
    },
    prenom: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },

    // OAuth social
    googleId:   { type: String, sparse: true },
    facebookId: { type: String, sparse: true },
    appleId:    { type: String, sparse: true },

    avatarUrl:     { type: String, default: '' },
    lastLogin:     { type: Date },

    // ── Champs ajoutés pour le ProfileScreen ─────────────────────────────────
    preferredZone: { type: String, trim: true, default: '' },  // vue 901
    settings:      { type: SettingsSchema, default: () => ({}) }, // vue 902
    isDeleted:     { type: Boolean, default: false },              // soft-delete
    deletedAt:     { type: Date,    default: null  },

    // ── Push notifications ────────────────────────────────────────────────────
    pushToken: { type: String, default: '' },

    // ── Système de points ─────────────────────────────────────────────────────
    pointsSolde: { type: Number, default: 100, min: 0 },

  },
  { timestamps: true }
);

// ── Index pour exclure les comptes supprimés des recherches normales ──────────
UserSchema.index({ isDeleted: 1 });

// ── Hash du mot de passe avant sauvegarde ────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Méthode de vérification du mot de passe ───────────────────────────────────
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Méthode pour retourner un objet public (sans champs sensibles) ────────────
UserSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.isDeleted;
  delete obj.deletedAt;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
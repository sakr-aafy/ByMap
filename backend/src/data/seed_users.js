/**
 * seed_users.js — Insère des utilisateurs de test dans MongoDB
 *
 * Utilisation :
 *   node src/data/seed_users.js
 *
 * Options :
 *   --clear   Supprime tous les users existants avant d'insérer
 *
 * Prérequis : fichier .env à la racine avec MONGO_URI défini.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ─── Connexion ────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI ||
  `mongodb+srv://waelwbouazizi_db_user:${process.env.DB_PASSWORD}@cluster0.e0hlyy1.mongodb.net/bymap?retryWrites=true&w=majority&appName=Cluster0`;

// ─── Modèle User (inline pour que le script soit autonome) ───────────────────
const UserSchema = new mongoose.Schema(
  {
    nom:          { type: String, trim: true, default: '' },
    prenom:       { type: String, trim: true, default: '' },
    email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone:        { type: String, unique: true, sparse: true, trim: true },
    password:     { type: String, select: false },
    role:         { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive:     { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: true },
    pointsSolde:  { type: Number, default: 100 },
    avatarUrl:    { type: String, default: '' },
    preferredZone: { type: String, default: '' },
    settings: {
      language:       { type: String, default: 'العربية' },
      notifications:  { type: Boolean, default: true },
      locationAccess: { type: Boolean, default: true },
    },
    isDeleted:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// ─── Utilisateurs à insérer ───────────────────────────────────────────────────
const USERS = [
  {
    nom: 'Admin',
    prenom: 'ByMap',
    email: 'admin@bymap.tn',
    password: 'admin123',
    role: 'admin',
    isEmailVerified: true,
  },
  {
    nom: 'Ben Ali',
    prenom: 'Ahmed',
    email: 'ahmed.benali@gmail.com',
    phone: '+21620000001',
    password: 'password123',
    role: 'user',
    preferredZone: 'Tunis',
    pointsSolde: 150,
  },
  {
    nom: 'Trabelsi',
    prenom: 'Sarra',
    email: 'sarra.trabelsi@gmail.com',
    phone: '+21620000002',
    password: 'password123',
    role: 'user',
    preferredZone: 'Sfax',
    pointsSolde: 200,
  },
  {
    nom: 'Chaabane',
    prenom: 'Mohamed',
    email: 'med.chaabane@gmail.com',
    phone: '+21620000003',
    password: 'password123',
    role: 'user',
    preferredZone: 'Sousse',
    pointsSolde: 80,
  },
  {
    nom: 'Jelassi',
    prenom: 'Fatma',
    email: 'fatma.jelassi@gmail.com',
    phone: '+21620000004',
    password: 'password123',
    role: 'user',
    preferredZone: 'Bizerte',
    pointsSolde: 120,
  },
  {
    nom: 'Kouki',
    prenom: 'Yassine',
    phone: '+21620000005',
    password: 'password123',
    role: 'user',
    pointsSolde: 100,
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────
async function main() {
  const clearFirst = process.argv.includes('--clear');

  await mongoose.connect(MONGO_URI);
  console.log('✅  Connecté à MongoDB');

  if (clearFirst) {
    await User.deleteMany({});
    console.log('🗑️   Collection users vidée');
  }

  let inserted = 0;
  let skipped  = 0;

  for (const userData of USERS) {
    const query = {};
    if (userData.email) query.email = userData.email;
    if (userData.phone) query.phone = userData.phone;

    const exists = await User.findOne({ $or: Object.entries(query).map(([k, v]) => ({ [k]: v })) });

    if (exists) {
      console.log(`⏭️   Ignoré (existe déjà) : ${userData.email || userData.phone}`);
      skipped++;
      continue;
    }

    const hashed = await bcrypt.hash(userData.password, 12);
    await User.create({ ...userData, password: hashed });
    console.log(`✅  Inséré : ${userData.prenom} ${userData.nom} — ${userData.email || userData.phone}`);
    inserted++;
  }

  console.log(`\n📊  Résultat : ${inserted} insérés, ${skipped} ignorés`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌  Erreur :', err.message);
  process.exit(1);
});

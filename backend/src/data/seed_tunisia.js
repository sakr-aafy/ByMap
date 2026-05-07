/**
 * seed_tunisia.js
 * Insère toutes les localités de tunisia.json dans la collection MongoDB "localites".
 *
 * Utilisation :
 *   node src/data/seed_tunisia.js
 *
 * Prérequis : fichier .env à la racine du backend avec MONGO_URI défini.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');

// ─── Chargement des données source ────────────────────────────────────────────
const TUNISIA = require('./tunisia.json');

// ─── Schéma Mongoose (inline pour que le script soit autonome) ────────────────
const LocaliteSchema = new mongoose.Schema(
  {
    gouvernorat: { type: String, required: true, trim: true },
    delegation:  { type: String, required: true, trim: true },
    localite:    { type: String, required: true, trim: true },
    cp:          { type: String, trim: true, default: '' },
    lat:         { type: Number, required: true },
    lng:         { type: Number, required: true },
  },
  { timestamps: false }
);
LocaliteSchema.index({ gouvernorat: 1 });
LocaliteSchema.index({ gouvernorat: 1, delegation: 1 });

const Localite = mongoose.models.Localite || mongoose.model('Localite', LocaliteSchema);

// ─── Transformation JSON → tableau de documents ───────────────────────────────
function buildDocs() {
  const docs = [];
  for (const [gouvernorat, locs] of Object.entries(TUNISIA)) {
    for (const loc of locs) {
      docs.push({
        gouvernorat,
        delegation: loc.delegation,
        localite:   loc.localite,
        cp:         loc.cp  || '',
        lat:        Number(loc.lat),
        lng:        Number(loc.lng),
      });
    }
  }
  return docs;
}

// ─── Script principal ─────────────────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌  MONGO_URI absent du fichier .env');
    process.exit(1);
  }

  console.log('🔗  Connexion à MongoDB…');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`✅  Connecté : ${mongoose.connection.host}`);

  // Préparer les documents
  const docs = buildDocs();
  console.log(`📄  ${docs.length} localités à insérer…`);

  // Vider l'ancienne collection
  const deleted = await Localite.deleteMany({});
  console.log(`🗑   ${deleted.deletedCount} ancienne(s) entrée(s) supprimée(s)`);

  // Insertion par lots de 500 pour limiter la mémoire
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    await Localite.insertMany(batch, { ordered: false });
    inserted += batch.length;
    const pct = Math.round((inserted / docs.length) * 100);
    process.stdout.write(`\r⏳  Insertion : ${inserted}/${docs.length}  (${pct}%)`);
  }

  console.log(`\n✅  Import terminé — ${inserted} localités enregistrées en base.`);

  await mongoose.disconnect();
  console.log('🔌  Déconnecté.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Erreur :', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});

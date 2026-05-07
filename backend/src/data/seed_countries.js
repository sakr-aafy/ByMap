/**
 * seed_countries.js
 * Insère algeria.json, france.json, germany.json, italy.json, spain.json
 * dans la collection MongoDB "pays".
 *
 * Utilisation :
 *   node src/data/seed_countries.js
 *
 * Prérequis : fichier .env à la racine du backend avec MONGO_URI défini.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');

// ─── Fichiers source ──────────────────────────────────────────────────────────
const FILES = [
  { file: 'algeria.json', code: 'DZ' },
  { file: 'france.json',  code: 'FR' },
  { file: 'germany.json', code: 'DE' },
  { file: 'italy.json',   code: 'IT' },
  { file: 'spain.json',   code: 'ES' },
];

// ─── Schéma Mongoose (inline pour autonomie du script) ────────────────────────
const CitySchema = new mongoose.Schema(
  { name: String, region: String, population: Number },
  { _id: false }
);

const PaysSchema = new mongoose.Schema(
  {
    code:          { type: String, required: true, unique: true },
    name:          String,
    name_fr:       { type: String, default: '' },
    official_name: { type: String, default: '' },
    capital:       { type: String, default: '' },
    flag:          { type: String, default: '' },
    population:    { type: Number, default: 0 },
    area_km2:      { type: Number, default: 0 },
    continent:     { type: String, default: '' },
    region:        { type: String, default: '' },
    phone_code:    { type: String, default: '' },
    coordinates: {
      latitude:  { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    cities: [CitySchema],
  },
  { timestamps: false }
);

const Pays = mongoose.models.Pays || mongoose.model('Pays', PaysSchema);

// ─── Transformation JSON → document Pays ─────────────────────────────────────
function buildDoc(data, code) {
  const cities = (data.cities || []).map(c => ({
    name:       c.name       || '',
    region:     c.region     || c.wilaya || '',
    population: c.population || 0,
  }));

  return {
    code,
    name:          data.name          || '',
    name_fr:       data.name_fr       || data.name || '',
    official_name: data.official_name || '',
    capital:       data.capital       || '',
    flag:          data.flag          || '',
    population:    data.population    || 0,
    area_km2:      data.area_km2      || 0,
    continent:     data.continent     || '',
    region:        data.region        || '',
    phone_code:    data.phone_code    || '',
    coordinates: {
      latitude:  (data.coordinates && data.coordinates.latitude)  || 0,
      longitude: (data.coordinates && data.coordinates.longitude) || 0,
    },
    cities,
  };
}

// ─── Script principal ─────────────────────────────────────────────────────────
async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌  MONGO_URI absent du fichier .env');
    process.exit(1);
  }

  console.log('🔗  Connexion à MongoDB…');
  await mongoose.connect(uri);
  console.log(`✅  Connecté : ${mongoose.connection.host}`);

  let totalInserted = 0;
  let totalUpdated  = 0;

  for (const { file, code } of FILES) {
    const filePath = path.join(__dirname, file);
    let data;
    try {
      data = require(filePath);
    } catch (e) {
      console.error(`❌  Impossible de lire ${file} : ${e.message}`);
      continue;
    }

    const doc = buildDoc(data, code);
    const result = await Pays.updateOne(
      { code },
      { $set: doc },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log(`✅  [${code}] ${doc.name_fr} — inséré (${doc.cities.length} villes)`);
      totalInserted++;
    } else {
      console.log(`🔄  [${code}] ${doc.name_fr} — mis à jour (${doc.cities.length} villes)`);
      totalUpdated++;
    }
  }

  console.log(`\n✅  Import terminé — ${totalInserted} insérés, ${totalUpdated} mis à jour.`);
  await mongoose.disconnect();
  console.log('🔌  Déconnecté.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Erreur :', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});

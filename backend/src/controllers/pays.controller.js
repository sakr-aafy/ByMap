const Pays = require('../models/Pays.model');
const path = require('path');

const COUNTRY_FILES = [
  { file: 'algeria.json', code: 'DZ' },
  { file: 'france.json',  code: 'FR' },
  { file: 'germany.json', code: 'DE' },
  { file: 'italy.json',   code: 'IT' },
  { file: 'spain.json',   code: 'ES' },
];

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

// POST /api/admin/pays/import
exports.importAll = async (req, res) => {
  try {
    let inserted = 0;
    let updated  = 0;
    const results = [];

    for (const { file, code } of COUNTRY_FILES) {
      const filePath = path.join(__dirname, '../data', file);
      let data;
      try { data = require(filePath); } catch (e) {
        results.push({ code, error: e.message });
        continue;
      }
      const doc = buildDoc(data, code);
      const r = await Pays.updateOne({ code }, { $set: doc }, { upsert: true });
      if (r.upsertedCount > 0) { inserted++; }
      else { updated++; }
      results.push({ code, name: doc.name_fr, cities: doc.cities.length });
    }

    res.json({ success: true, inserted, updated, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/pays  →  list all countries (no cities)
exports.getAll = async (req, res) => {
  try {
    const pays = await Pays.find({}, '-cities').sort({ name_fr: 1 });
    res.json({ pays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/pays/:code  →  one country with cities
exports.getOne = async (req, res) => {
  try {
    const pays = await Pays.findOne({ code: req.params.code.toUpperCase() });
    if (!pays) return res.status(404).json({ error: 'Pays introuvable' });
    res.json({ pays });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/pays/:code/cities  →  just the cities array
exports.getCities = async (req, res) => {
  try {
    const pays = await Pays.findOne(
      { code: req.params.code.toUpperCase() },
      'cities name_fr'
    );
    if (!pays) return res.status(404).json({ error: 'Pays introuvable' });
    res.json({ cities: pays.cities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

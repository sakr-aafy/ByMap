const Localite = require('../models/Localite.model');
const TUNISIA  = require('../data/tunisia.json');

// POST /api/admin/localites/import — admin only
// Vide la collection puis réinsère toutes les localités de tunisia.json
exports.importTunisia = async (_req, res) => {
  try {
    const docs = [];
    for (const [gouvernorat, locs] of Object.entries(TUNISIA)) {
      for (const loc of locs) {
        docs.push({
          gouvernorat,
          delegation: loc.delegation,
          localite:   loc.localite,
          cp:         loc.cp || '',
          lat:        Number(loc.lat),
          lng:        Number(loc.lng),
        });
      }
    }

    await Localite.deleteMany({});
    const result = await Localite.insertMany(docs, { ordered: false });
    res.status(201).json({ imported: result.length, total: docs.length });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// GET /api/localites/gouvernorats — public
// Retourne la liste triée des gouvernorats distincts
exports.getGouvernorats = async (_req, res) => {
  try {
    const gouvernorats = await Localite.distinct('gouvernorat');
    res.json({ gouvernorats: gouvernorats.sort() });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/localites/delegations?gouvernorat=Ariana — public
// Retourne les délégations d'un gouvernorat
exports.getDelegations = async (req, res) => {
  try {
    const { gouvernorat } = req.query;
    if (!gouvernorat) return res.status(400).json({ message: 'Paramètre gouvernorat requis' });
    const delegations = await Localite.distinct('delegation', { gouvernorat });
    res.json({ delegations: delegations.sort() });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// GET /api/localites?gouvernorat=Ariana&delegation=Ariana+Ville — public
// Retourne les localités (avec lat/lng) pour une délégation donnée
exports.getLocalites = async (req, res) => {
  try {
    const { gouvernorat, delegation } = req.query;
    const filter = {};
    if (gouvernorat) filter.gouvernorat = gouvernorat;
    if (delegation)  filter.delegation  = delegation;
    const localites = await Localite
      .find(filter, 'localite lat lng -_id')
      .sort({ localite: 1 })
      .lean();
    res.json({ localites });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

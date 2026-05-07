const Zone = require('../models/Zone.model');

// GET /api/zones  — public
exports.getAll = async (_req, res) => {
  try {
    const zones = await Zone.find({ active: true }).sort({ createdAt: -1 });
    res.json({ zones });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// POST /api/admin/zones  — admin only
exports.create = async (req, res) => {
  try {
    const { name, pays, gouvernorat, ville, description, lat, lng } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Le nom est obligatoire' });
    if (lat == null || lng == null) return res.status(400).json({ message: 'Les coordonnées sont obligatoires' });

    const zone = await Zone.create({
      name: name.trim(), pays: pays || '', gouvernorat, ville, description,
      lat: Number(lat), lng: Number(lng),
    });
    res.status(201).json({ zone });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// POST /api/admin/zones/bulk  — admin only
exports.importBulk = async (req, res) => {
  try {
    const { zones } = req.body;
    if (!Array.isArray(zones) || zones.length === 0)
      return res.status(400).json({ message: 'Aucune zone à importer' });

    const valid = zones
      .filter(z => z.name?.toString().trim() && z.lat != null && z.lng != null)
      .map(z => ({
        name:        z.name.toString().trim(),
        pays:        z.pays        || '',
        gouvernorat: z.gouvernorat || '',
        ville:       z.ville       || '',
        description: z.description || '',
        lat:         Number(z.lat),
        lng:         Number(z.lng),
        active:      true,
      }));

    if (valid.length === 0)
      return res.status(400).json({ message: 'Aucune zone valide dans les données' });

    const result = await Zone.insertMany(valid, { ordered: false });
    res.status(201).json({ imported: result.length, total: zones.length });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// DELETE /api/admin/zones/:id  — admin only
exports.remove = async (req, res) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) return res.status(404).json({ message: 'Zone introuvable' });
    res.json({ message: 'Zone supprimée' });
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

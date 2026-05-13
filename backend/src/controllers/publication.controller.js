// src/controllers/publication.controller.js
const Publication              = require('../models/Publication.model');
const User                     = require('../models/User.model');
const Favorite                 = require('../models/Favorite.model');
const { uploadToCloud, deleteFromCloud } = require('../middleware/upload.middleware');
const { sendPush }             = require('../services/push.service');

// ─── Helper : construire l'objet localisation depuis req.body ─────────────────
const parseLocalisation = (body, prefix = '') => ({
  ville:       body[`${prefix}ville`]       || '',
  gouvernorat: body[`${prefix}gouvernorat`] || '',
  delegation:  body[`${prefix}delegation`]  || '',
});

// ─── POST /api/publications ───────────────────────────────────────────────────
// Créer une nouvelle publication (avec ou sans médias)
exports.create = async (req, res) => {
  try {
    const { mode, description } = req.body;

    if (!description || !description.trim())
      return res.status(400).json({ message: 'La description est obligatoire' });

    if (!['local', 'duo'].includes(mode))
      return res.status(400).json({ message: 'Mode invalide (local ou duo)' });

    // ── Vérifier le solde de points (10 points requis par publication) ────────
    const author = await User.findById(req.user.id);
    if (!author) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const solde = typeof author.pointsSolde === 'number' ? author.pointsSolde : 100;
    if (solde < 10) {
      return res.status(402).json({
        message: 'Solde insuffisant. Achetez des points pour publier (10 points par annonce).',
        code: 'INSUFFICIENT_POINTS',
        pointsSolde: solde,
      });
    }

    // Déduire 10 points
    author.pointsSolde = solde - 10;
    await author.save({ validateBeforeSave: false });

    // ── Upload des médias envoyés ─────────────────────────────────────────────
    const medias = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isVideo = file.mimetype.startsWith('video/');
        const { url, publicId } = await uploadToCloud(file.path, isVideo);
        medias.push({ url, publicId, type: isVideo ? 'video' : 'image' });
      }
    }

    // ── Construire les champs de localisation selon le mode ───────────────────
    const pubData = {
      auteur:      req.user.id,
      mode,
      description: description.trim(),
      medias,
    };

    if (mode === 'local') {
      pubData.localisation = parseLocalisation(req.body);
    } else {
      pubData.localisationDebut = parseLocalisation(req.body, 'debut_');
      pubData.localisationFin   = parseLocalisation(req.body, 'fin_');
    }

    const pub = await Publication.create(pubData);
    await pub.populate('auteur', 'nom prenom avatarUrl');

    // ── Notify users who favorited this zone (fire-and-forget) ───────────────
    (async () => {
      try {
        const zoneNames = new Set();
        if (mode === 'local') {
          const n = pubData.localisation?.delegation || pubData.localisation?.gouvernorat || pubData.localisation?.ville;
          if (n) zoneNames.add(n);
        } else {
          const nD = pubData.localisationDebut?.delegation || pubData.localisationDebut?.gouvernorat || pubData.localisationDebut?.ville;
          const nF = pubData.localisationFin?.delegation   || pubData.localisationFin?.gouvernorat   || pubData.localisationFin?.ville;
          if (nD) zoneNames.add(nD);
          if (nF) zoneNames.add(nF);
        }
        if (!zoneNames.size) return;

        const favs = await Favorite.find({ zoneName: { $in: [...zoneNames] }, user: { $ne: req.user.id } }).select('user');
        const userIds = [...new Set(favs.map(f => String(f.user)))];
        if (!userIds.length) return;

        const users = await User.find({ _id: { $in: userIds }, pushToken: { $ne: '' } }).select('pushToken');
        const tokens = users.map(u => u.pushToken).filter(Boolean);
        const authorName = `${author.prenom || ''} ${author.nom || ''}`.trim() || 'Quelqu\'un';
        const zoneName   = [...zoneNames][0];
        await sendPush(tokens, `Nouveau post dans ${zoneName}`, `${authorName} : ${description.slice(0, 80)}`, { screen: 'PublicationDetail', params: { id: String(pub._id) } });
      } catch {}
    })();

    res.status(201).json({ message: 'Publication créée', publication: pub });
  } catch (err) {
    console.error('[CREATE PUB]', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── GET /api/publications/zone-dots ─────────────────────────────────────────
// Retourne les zones groupées avec comptages { zones: [{name, gouvernorat, local, duo}] }
exports.getZoneDots = async (_req, res) => {
  try {
    const pubs = await Publication.find({ statut: 'active', expiresAt: { $gt: new Date() } })
      .select('mode localisation localisationDebut localisationFin')
      .lean();

    const counts = {};
    const addZone = (name, gouvernorat, mode) => {
      if (!name) return;
      if (!counts[name]) counts[name] = { name, gouvernorat: gouvernorat || '', local: 0, duo: 0 };
      if (mode === 'local') counts[name].local++;
      else counts[name].duo++;
    };

    pubs.forEach(p => {
      if (p.mode === 'local') {
        const name = p.localisation?.delegation || p.localisation?.ville || p.localisation?.gouvernorat;
        addZone(name, p.localisation?.gouvernorat, 'local');
      } else {
        const nD = p.localisationDebut?.delegation || p.localisationDebut?.ville || p.localisationDebut?.gouvernorat;
        const nF = p.localisationFin?.delegation   || p.localisationFin?.ville   || p.localisationFin?.gouvernorat;
        addZone(nD, p.localisationDebut?.gouvernorat, 'duo');
        addZone(nF, p.localisationFin?.gouvernorat,   'duo');
      }
    });

    res.json({ zones: Object.values(counts) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── GET /api/publications ────────────────────────────────────────────────────
// Liste paginée avec filtres (ville, mode, auteur)
exports.getAll = async (req, res) => {
  try {
    const {
      page  = 1,
      limit = 15,
      mode,
      ville,
      auteur,
      search,
    } = req.query;

    // Auto-archive posts whose time has expired
    const now = new Date();
    await Publication.updateMany(
      { statut: 'active', expiresAt: { $lte: now } },
      { $set: { statut: 'archivee' } }
    );

    const filter = { statut: 'active', expiresAt: { $gt: now } };
    if (mode)   filter.mode   = mode;
    if (auteur) filter.auteur = auteur;
    if (search) filter.description = { $regex: search, $options: 'i' };
    if (ville) {
      filter.$or = [
        { 'localisation.ville':              { $regex: ville, $options: 'i' } },
        { 'localisation.gouvernorat':        { $regex: ville, $options: 'i' } },
        { 'localisationDebut.ville':         { $regex: ville, $options: 'i' } },
        { 'localisationDebut.gouvernorat':   { $regex: ville, $options: 'i' } },
        { 'localisationFin.ville':           { $regex: ville, $options: 'i' } },
        { 'localisationFin.gouvernorat':     { $regex: ville, $options: 'i' } },
      ];
    }

    const total = await Publication.countDocuments(filter);
    const pubs  = await Publication.find(filter)
      .populate('auteur', 'nom prenom avatarUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      total,
      page:  Number(page),
      pages: Math.ceil(total / limit),
      publications: pubs,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET /api/publications/:id ────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const pub = await Publication.findById(req.params.id)
      .populate('auteur', 'nom prenom avatarUrl');

    const expired = pub?.expiresAt && pub.expiresAt < new Date();
    if (!pub || pub.statut === 'supprimee' || pub.statut === 'archivee' || expired)
      return res.status(404).json({ message: 'Publication introuvable' });

    // Incrémenter les vues
    pub.vues += 1;
    await pub.save({ validateBeforeSave: false });

    res.json({ publication: pub });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── PUT /api/publications/:id ────────────────────────────────────────────────
// Modifier description et/ou localisation (pas les médias ici)
exports.update = async (req, res) => {
  try {
    const pub = await Publication.findById(req.params.id);
    if (!pub) return res.status(404).json({ message: 'Publication introuvable' });

    // Seul l'auteur peut modifier
    if (pub.auteur.toString() !== req.user.id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Non autorisé' });

    const { description } = req.body;
    if (description) pub.description = description.trim();

    if (pub.mode === 'local') {
      pub.localisation = parseLocalisation(req.body);
    } else {
      pub.localisationDebut = parseLocalisation(req.body, 'debut_');
      pub.localisationFin   = parseLocalisation(req.body, 'fin_');
    }

    await pub.save();
    res.json({ message: 'Publication mise à jour', publication: pub });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── DELETE /api/publications/:id ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const pub = await Publication.findById(req.params.id);
    if (!pub) return res.status(404).json({ message: 'Publication introuvable' });

    if (pub.auteur.toString() !== req.user.id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Non autorisé' });

    // Supprimer les médias du cloud
    for (const media of pub.medias) {
      if (media.publicId) {
        await deleteFromCloud(media.publicId, media.type === 'video');
      }
    }

    // Suppression logique
    pub.statut = 'supprimee';
    await pub.save({ validateBeforeSave: false });

    res.json({ message: 'Publication supprimée' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/publications/:id/like ─────────────────────────────────────────
exports.toggleLike = async (req, res) => {
  try {
    const pub    = await Publication.findById(req.params.id);
    if (!pub) return res.status(404).json({ message: 'Publication introuvable' });

    const userId = req.user.id.toString();
    const index  = pub.likes.findIndex((id) => id.toString() === userId);

    if (index === -1) {
      pub.likes.push(req.user.id);   // Liker
    } else {
      pub.likes.splice(index, 1);    // Unliker
    }

    await pub.save({ validateBeforeSave: false });
    res.json({ liked: index === -1, nbLikes: pub.likes.length });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/publications/:id/renew ────────────────────────────────────────
// Renouvelle une publication de 24h
exports.renew = async (req, res) => {
  try {
    const pub = await Publication.findById(req.params.id);
    if (!pub) return res.status(404).json({ message: 'Publication introuvable' });

    if (pub.auteur.toString() !== req.user.id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Non autorisé' });

    const now = new Date();
    // Prolonge depuis maintenant ou depuis l'expiry actuel si encore valide
    const currentExpiry = pub.expiresAt ? new Date(pub.expiresAt) : now;
    const base = currentExpiry > now ? currentExpiry : now;
    pub.expiresAt = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    pub.statut = 'active';
    await pub.save({ validateBeforeSave: false });

    res.json({ message: 'Publication renouvelée', expiresAt: pub.expiresAt });
  } catch (err) {
    console.error('[RENEW PUB]', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── POST /api/publications/:id/rate ─────────────────────────────────────────
exports.rate = async (req, res) => {
  try {
    const v = Number(req.body.value);
    if (!v || v < 1 || v > 5)
      return res.status(400).json({ message: 'Note invalide (1 à 5)' });

    const pub = await Publication.findById(req.params.id);
    if (!pub || pub.statut === 'supprimee')
      return res.status(404).json({ message: 'Publication introuvable' });

    const userId = req.user.id.toString();
    const idx = pub.ratings.findIndex(r => r.user.toString() === userId);
    if (idx === -1) pub.ratings.push({ user: req.user.id, value: v });
    else pub.ratings[idx].value = v;

    await pub.save({ validateBeforeSave: false });
    res.json({ avgRating: pub.avgRating, nbRatings: pub.nbRatings, userRating: v });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ─── GET /api/publications/mes ────────────────────────────────────────────────
// Publications de l'utilisateur connecté
exports.getMes = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const filter = { auteur: req.user.id, statut: { $ne: 'supprimee' } };

    const total = await Publication.countDocuments(filter);
    const pubs  = await Publication.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, page: Number(page), pages: Math.ceil(total / limit), publications: pubs });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

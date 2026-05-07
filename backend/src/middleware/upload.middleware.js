// src/middleware/upload.middleware.js
// Gestion des uploads de médias (images & vidéos)
// Stockage : Cloudinary en production, dossier local en développement

const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

// ─── Stockage local (développement / fallback) ────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// ─── Filtre MIME ──────────────────────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé : ${file.mimetype}`), false);
  }
};

// ─── Instance multer ──────────────────────────────────────────────────────────
const upload = multer({
  storage:   diskStorage,
  fileFilter,
  limits: {
    fileSize:  100 * 1024 * 1024,   // 100 MB max par fichier
    files:     10,                   // 10 fichiers max par requête
  },
});

// ─── Uploader Cloudinary (activé si CLOUDINARY_CLOUD_NAME est défini) ─────────
let cloudinary = null;

const getCloudinary = () => {
  if (cloudinary) return cloudinary;
  if (!process.env.CLOUDINARY_CLOUD_NAME) return null;

  const { v2: cloud } = require('cloudinary');
  cloud.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  cloudinary = cloud;
  return cloud;
};

// ─── Fonction utilitaire : upload un fichier vers Cloudinary ─────────────────
const uploadToCloud = async (filePath, isVideo = false) => {
  const cloud = getCloudinary();
  if (!cloud) {
    // Mode local : retourner l'URL relative
    const filename = path.basename(filePath);
    return {
      url:      `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/${filename}`,
      publicId: filename,
    };
  }

  const result = await cloud.uploader.upload(filePath, {
    folder:         'bymap/publications',
    resource_type:  isVideo ? 'video' : 'image',
    // Pour les vidéos : limiter à 60 secondes
    ...(isVideo && { transformation: [{ duration: '60' }] }),
  });

  // Supprimer le fichier local temporaire après upload Cloudinary
  fs.unlink(filePath, () => {});

  return { url: result.secure_url, publicId: result.public_id };
};

// ─── Fonction utilitaire : supprimer un média de Cloudinary ──────────────────
const deleteFromCloud = async (publicId, isVideo = false) => {
  const cloud = getCloudinary();
  if (!cloud) {
    // Supprimer le fichier local
    const localPath = path.join(uploadDir, publicId);
    if (fs.existsSync(localPath)) fs.unlink(localPath, () => {});
    return;
  }
  await cloud.uploader.destroy(publicId, {
    resource_type: isVideo ? 'video' : 'image',
  });
};

module.exports = { upload, uploadToCloud, deleteFromCloud };

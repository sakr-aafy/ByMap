// server.js — Point d'entrée principal ByMap Backend
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
require('dotenv').config();

const connectDB          = require('./src/config/db.config');
const authRoutes         = require('./src/routes/auth.routes');
const userRoutes         = require('./src/routes/user.routes');
const adminRoutes        = require('./src/routes/admin.routes');
const publicationRoutes  = require('./src/routes/publication.routes');

const app = express();
app.set('etag', false); // désactive les 304 Not Modified

// ─── Connexion MongoDB ────────────────────────────────────────────────────────
connectDB();

// ─── Middlewares globaux ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Fichiers uploadés (dev) ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/publications',  publicationRoutes);

// ─── Route de santé ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── Gestion des erreurs 404 ──────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route introuvable' }));

// ─── Gestionnaire d'erreurs global ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur lance sur http://localhost:${PORT}`));

module.exports = app;

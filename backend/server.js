// server.js — Point d'entrée principal ByMap Backend
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB         = require('./src/config/db.config');
const authRoutes        = require('./src/routes/auth.routes');
const userRoutes        = require('./src/routes/user.routes');
const adminRoutes       = require('./src/routes/admin.routes');
const publicationRoutes = require('./src/routes/publication.routes');
const messageRoutes     = require('./src/routes/message.routes');
const favoriteRoutes    = require('./src/routes/favorite.routes');
const zoneRoutes        = require('./src/routes/zone.routes');
const localiteRoutes    = require('./src/routes/localite.routes');
const paysRoutes        = require('./src/routes/pays.routes');

const app        = express();
const httpServer = http.createServer(app);

app.set('etag', false);

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
app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/messages',    messageRoutes);
app.use('/api/favorites',   favoriteRoutes);
app.use('/api/zones',       zoneRoutes);
app.use('/api/localites',   localiteRoutes);
app.use('/api/pays',        paysRoutes);

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

// ─── Socket.io — Signalisation WebRTC ────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// userId → socketId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  // L'utilisateur s'enregistre avec son ID
  socket.on('register', (userId) => {
    onlineUsers.set(String(userId), socket.id);
    socket.userId = String(userId);
  });

  // ── Appel sortant : envoyer l'offre au destinataire ──────────────────────
  socket.on('call-offer', ({ to, offer, callerId, callerName }) => {
    const targetSocket = onlineUsers.get(String(to));
    if (targetSocket) {
      io.to(targetSocket).emit('incoming-call', {
        from:       socket.userId,
        callerId,
        callerName,
        offer,
      });
    } else {
      socket.emit('call-unavailable', { to });
    }
  });

  // ── Réponse à l'appel ────────────────────────────────────────────────────
  socket.on('call-answer', ({ to, answer }) => {
    const targetSocket = onlineUsers.get(String(to));
    if (targetSocket) io.to(targetSocket).emit('call-answered', { answer });
  });

  // ── Candidat ICE ─────────────────────────────────────────────────────────
  socket.on('ice-candidate', ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(String(to));
    if (targetSocket) io.to(targetSocket).emit('ice-candidate', { candidate });
  });

  // ── Refus d'appel ────────────────────────────────────────────────────────
  socket.on('call-reject', ({ to }) => {
    const targetSocket = onlineUsers.get(String(to));
    if (targetSocket) io.to(targetSocket).emit('call-rejected');
  });

  // ── Fin d'appel ───────────────────────────────────────────────────────────
  socket.on('call-end', ({ to }) => {
    const targetSocket = onlineUsers.get(String(to));
    if (targetSocket) io.to(targetSocket).emit('call-ended');
  });

  // ── Déconnexion ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userId) onlineUsers.delete(socket.userId);
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Serveur lance sur http://localhost:${PORT}`));

module.exports = app;

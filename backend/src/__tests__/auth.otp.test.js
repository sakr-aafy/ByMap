// src/__tests__/auth.otp.test.js
// Tests des endpoints OTP (inscription + réinitialisation mot de passe)
// Utilise mongodb-memory-server — aucune connexion à la DB réelle

jest.mock('../utils/email', () => ({
  sendOtpEmail:      jest.fn().mockResolvedValue(undefined),
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
}));

const mongoose              = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express               = require('express');
const request               = require('supertest');
const authRoutes            = require('../routes/auth.routes');
const User                  = require('../models/User.model');
const Otp                   = require('../models/Otp.model');
const { sendOtpEmail }      = require('../utils/email');

let mongod;
let app;

// ── App minimaliste — auth seulement, sans sécurité (testée séparément) ───────
function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/auth', authRoutes);
  return a;
}

// IP unique par fichier pour ne pas interférer avec les compteurs du middleware
const IP = '5.5.5.5';

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = makeApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Otp.deleteMany({});
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth — Endpoints OTP', () => {

  // ── POST /api/auth/send-register-otp ────────────────────────────────────
  describe('POST /api/auth/send-register-otp', () => {
    test('400 si le champ email est absent', async () => {
      const res = await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email requis');
    });

    test('409 si l\'email est déjà enregistré', async () => {
      await User.create({ email: 'pris@example.com', password: 'motdepasse123' });
      const res = await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'pris@example.com' });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Email déjà utilisé');
    });

    test('200 — envoie le code OTP et appelle sendOtpEmail', async () => {
      const res = await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'nouveau@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Code envoyé');
      expect(sendOtpEmail).toHaveBeenCalledWith(
        'nouveau@example.com',
        expect.stringMatching(/^\d{6}$/),
        'register'
      );
    });

    test('le code OTP est stocké en base de données', async () => {
      await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'stocke@example.com' });
      const otp = await Otp.findOne({ email: 'stocke@example.com', type: 'register' });
      expect(otp).not.toBeNull();
      expect(otp.code).toMatch(/^\d{6}$/);
      expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('supprime l\'ancien OTP avant d\'en créer un nouveau', async () => {
      const email = 'double@example.com';
      await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email });
      await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email });
      const count = await Otp.countDocuments({ email, type: 'register' });
      expect(count).toBe(1);
    });

    test('le code OTP expire dans 10 minutes', async () => {
      await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'expiry@example.com' });
      const otp = await Otp.findOne({ email: 'expiry@example.com' });
      const diffMinutes = (otp.expiresAt - Date.now()) / 60_000;
      expect(diffMinutes).toBeGreaterThan(9);
      expect(diffMinutes).toBeLessThanOrEqual(10);
    });
  });

  // ── POST /api/auth/verify-register-otp ──────────────────────────────────
  describe('POST /api/auth/verify-register-otp', () => {
    test('400 si le code est incorrect', async () => {
      await Otp.create({
        email: 'verify@example.com',
        code: '123456',
        type: 'register',
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/verify-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'verify@example.com', code: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Code invalide');
    });

    test('400 si le code est expiré', async () => {
      await Otp.create({
        email: 'expire@example.com',
        code: '654321',
        type: 'register',
        expiresAt: new Date(Date.now() - 1000), // Déjà expiré
      });
      const res = await request(app)
        .post('/api/auth/verify-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'expire@example.com', code: '654321' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Code expiré');
    });

    test('200 — vérifie l\'email et supprime l\'OTP de la base', async () => {
      await Otp.create({
        email: 'good@example.com',
        code: '112233',
        type: 'register',
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/verify-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'good@example.com', code: '112233' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email vérifié');
      const remaining = await Otp.findOne({ email: 'good@example.com' });
      expect(remaining).toBeNull();
    });

    test('rejette un code d\'un type différent (reset vs register)', async () => {
      await Otp.create({
        email: 'wrongtype@example.com',
        code: '999777',
        type: 'reset', // type différent
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/verify-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email: 'wrongtype@example.com', code: '999777' });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/auth/forgot-password ──────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    test('400 si l\'email est absent', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('x-forwarded-for', IP)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email requis');
    });

    test('404 si l\'email n\'est pas enregistré', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'fantome@example.com' });
      expect(res.status).toBe(404);
    });

    test('200 — envoie le code de réinitialisation quand l\'utilisateur existe', async () => {
      await User.create({ email: 'reset@example.com', password: 'ancienmdp123' });
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'reset@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Code de réinitialisation envoyé');
      expect(sendOtpEmail).toHaveBeenCalledWith(
        'reset@example.com',
        expect.stringMatching(/^\d{6}$/),
        'reset'
      );
    });

    test('stocke un OTP de type "reset" en base de données', async () => {
      await User.create({ email: 'resetstore@example.com', password: 'pass12345' });
      await request(app)
        .post('/api/auth/forgot-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'resetstore@example.com' });
      const otp = await Otp.findOne({ email: 'resetstore@example.com', type: 'reset' });
      expect(otp).not.toBeNull();
      expect(otp.code).toMatch(/^\d{6}$/);
    });
  });

  // ── POST /api/auth/verify-reset-code ────────────────────────────────────
  describe('POST /api/auth/verify-reset-code', () => {
    test('400 pour un code invalide', async () => {
      await Otp.create({
        email: 'rc@example.com',
        code: '999888',
        type: 'reset',
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/verify-reset-code')
        .set('x-forwarded-for', IP)
        .send({ email: 'rc@example.com', code: '111111' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Code invalide');
    });

    test('400 pour un code expiré', async () => {
      await Otp.create({
        email: 'rcexp@example.com',
        code: '444555',
        type: 'reset',
        expiresAt: new Date(Date.now() - 1000),
      });
      const res = await request(app)
        .post('/api/auth/verify-reset-code')
        .set('x-forwarded-for', IP)
        .send({ email: 'rcexp@example.com', code: '444555' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Code expiré');
    });

    test('200 pour un code valide', async () => {
      await Otp.create({
        email: 'rcok@example.com',
        code: '777666',
        type: 'reset',
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/verify-reset-code')
        .set('x-forwarded-for', IP)
        .send({ email: 'rcok@example.com', code: '777666' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Code valide');
    });
  });

  // ── POST /api/auth/reset-password ───────────────────────────────────────
  describe('POST /api/auth/reset-password', () => {
    test('400 si le mot de passe est trop court (< 6 caractères)', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'x@x.com', code: '000000', newPassword: '123' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/court/i);
    });

    test('400 si le code est invalide', async () => {
      await User.create({ email: 'resetfail@example.com', password: 'oldpassword123' });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'resetfail@example.com', code: 'mauvais', newPassword: 'newpassword456' });
      expect(res.status).toBe(400);
    });

    test('400 si le code est expiré', async () => {
      await User.create({ email: 'resetexp@example.com', password: 'oldpassword123' });
      await Otp.create({
        email: 'resetexp@example.com',
        code: '123123',
        type: 'reset',
        expiresAt: new Date(Date.now() - 1000),
      });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'resetexp@example.com', code: '123123', newPassword: 'newpassword456' });
      expect(res.status).toBe(400);
    });

    test('200 — réinitialise le mot de passe et supprime l\'OTP', async () => {
      await User.create({ email: 'resetok@example.com', password: 'ancienmdp123' });
      await Otp.create({
        email: 'resetok@example.com',
        code: '777888',
        type: 'reset',
        expiresAt: new Date(Date.now() + 600_000),
      });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'resetok@example.com', code: '777888', newPassword: 'nouveaumdpSecure' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Mot de passe réinitialisé avec succès');
      const otp = await Otp.findOne({ email: 'resetok@example.com' });
      expect(otp).toBeNull();
    });

    test('le nouveau mot de passe fonctionne pour la connexion', async () => {
      await User.create({ email: 'loginafter@example.com', password: 'ancienmdp123' });
      await Otp.create({
        email: 'loginafter@example.com',
        code: '135246',
        type: 'reset',
        expiresAt: new Date(Date.now() + 600_000),
      });
      await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'loginafter@example.com', code: '135246', newPassword: 'nouveaumdp456' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', IP)
        .send({ email: 'loginafter@example.com', password: 'nouveaumdp456' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();
    });

    test('l\'ancien mot de passe ne fonctionne plus après réinitialisation', async () => {
      await User.create({ email: 'oldpwd@example.com', password: 'ancienmdp123' });
      await Otp.create({
        email: 'oldpwd@example.com',
        code: '246135',
        type: 'reset',
        expiresAt: new Date(Date.now() + 600_000),
      });
      await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email: 'oldpwd@example.com', code: '246135', newPassword: 'nouveaumdp456' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', IP)
        .send({ email: 'oldpwd@example.com', password: 'ancienmdp123' });
      expect(loginRes.status).toBe(401);
    });
  });

  // ── Flux complet inscription ─────────────────────────────────────────────
  describe('Flux complet — Inscription avec OTP', () => {
    test('envoyer OTP → vérifier OTP → créer compte', async () => {
      const email = 'flux@example.com';

      // 1. Envoyer l'OTP
      const sendRes = await request(app)
        .post('/api/auth/send-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email });
      expect(sendRes.status).toBe(200);

      // Récupérer le code depuis la base (en test on y a accès)
      const otp = await Otp.findOne({ email, type: 'register' });
      expect(otp).not.toBeNull();

      // 2. Vérifier l'OTP
      const verifyRes = await request(app)
        .post('/api/auth/verify-register-otp')
        .set('x-forwarded-for', IP)
        .send({ email, code: otp.code });
      expect(verifyRes.status).toBe(200);

      // 3. Créer le compte
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('x-forwarded-for', IP)
        .send({ email, password: 'motdepasseSecure', prenom: 'Ali', nom: 'Ben Salem' });
      expect(registerRes.status).toBe(201);
      expect(registerRes.body.accessToken).toBeDefined();
    });
  });

  // ── Flux complet réinitialisation mot de passe ───────────────────────────
  describe('Flux complet — Réinitialisation mot de passe', () => {
    test('forgot-password → verify-reset-code → reset-password', async () => {
      const email = 'fluxreset@example.com';
      await User.create({ email, password: 'ancienmdp123' });

      // 1. Demander le code de réinitialisation
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .set('x-forwarded-for', IP)
        .send({ email });
      expect(forgotRes.status).toBe(200);

      // Récupérer le code depuis la base
      const otp = await Otp.findOne({ email, type: 'reset' });
      expect(otp).not.toBeNull();

      // 2. Vérifier le code
      const verifyRes = await request(app)
        .post('/api/auth/verify-reset-code')
        .set('x-forwarded-for', IP)
        .send({ email, code: otp.code });
      expect(verifyRes.status).toBe(200);

      // 3. Réinitialiser le mot de passe
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .set('x-forwarded-for', IP)
        .send({ email, code: otp.code, newPassword: 'nouveaumdpSecure' });
      expect(resetRes.status).toBe(200);

      // 4. Vérifier que le nouveau mot de passe fonctionne
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('x-forwarded-for', IP)
        .send({ email, password: 'nouveaumdpSecure' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.accessToken).toBeDefined();
    });
  });

});

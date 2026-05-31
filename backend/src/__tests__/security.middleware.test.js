// src/__tests__/security.middleware.test.js
// Tests pour le middleware de sécurité — 7 types d'attaques

jest.mock('../utils/email', () => ({
  sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail:      jest.fn().mockResolvedValue(undefined),
}));

const http     = require('http');
const express  = require('express');
const request  = require('supertest');
const { sendSecurityAlert } = require('../utils/email');
const securityMiddleware    = require('../middleware/security.middleware');

// ── App de test minimale ──────────────────────────────────────────────────────
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(securityMiddleware);
  app.all('/test', (_req, res) => res.json({ ok: true }));
  app.post('/login',           (_req, res) => res.status(401).json({ message: 'Mot de passe incorrect' }));
  app.post('/forgot-password', (_req, res) => res.status(404).json({ message: 'Email introuvable' }));
  return app;
}

// ── Requête HTTP brute — contourne la normalisation des clients HTTP ───────────
function rawGet(server, path, ip = '10.0.1.1') {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: {
          'x-forwarded-for': ip,
          'user-agent': 'Mozilla/5.0',
          connection: 'close',
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: {} }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Un seul serveur pour tous les tests (évite les handles orphelins) ─────────
let server;

beforeAll(done => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  server = makeApp().listen(0, done);
});

afterAll(done => {
  console.warn.mockRestore();
  if (server.closeAllConnections) server.closeAllConnections();
  server.close(done);
});

beforeEach(() => { jest.clearAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
describe('Security Middleware — 7 types d\'attaques', () => {

  // ── 1. Détection Scanner / Outil d'audit ────────────────────────────────
  describe('1 — Scanner / Outil d\'audit', () => {
    const scanners = [
      ['sqlmap',      'sqlmap/1.7.10#stable'],
      ['nikto',       'Nikto/2.1.6'],
      ['nmap',        'nmap scripting engine'],
      ['nuclei',      'nuclei/2.9.0'],
      ['metasploit',  'Metasploit Framework/4.21'],
      ['gobuster',    'gobuster/3.6'],
      ['dirbuster',   'DirBuster-1.0-RC1'],
      ['burpsuite',   'BurpSuite Enterprise/2023.10'],
    ];

    test.each(scanners)('bloque user-agent "%s"', async (_, ua) => {
      const res = await request(server)
        .get('/test')
        .set('User-Agent', ua)
        .set('x-forwarded-for', `1.1.1.${Math.floor(Math.random() * 200) + 1}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden');
    });

    test('laisse passer un navigateur normal', async () => {
      const res = await request(server)
        .get('/test')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .set('x-forwarded-for', '1.2.3.4');
      expect(res.status).toBe(200);
    });

    test('envoie une alerte email lors d\'une détection scanner', async () => {
      await request(server)
        .get('/test')
        .set('User-Agent', 'sqlmap/1.7')
        .set('x-forwarded-for', '1.9.9.1');
      expect(sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({ type: "Scanner / Outil d'audit" })
      );
    });
  });

  // ── 2. Rate Limiting / DDoS ──────────────────────────────────────────────
  describe('2 — Rate Limit / DDoS', () => {
    test('retourne 429 après 150 requêtes depuis la même IP', async () => {
      const ip = '192.168.50.50';
      const results = await Promise.all(
        Array.from({ length: 151 }, () =>
          request(server)
            .get('/test')
            .set('x-forwarded-for', ip)
            .set('User-Agent', 'Mozilla/5.0')
        )
      );
      expect(results.map(r => r.status)).toContain(429);
    });

    test('laisse passer les requêtes en dessous de la limite', async () => {
      const res = await request(server)
        .get('/test')
        .set('x-forwarded-for', '192.168.51.51')
        .set('User-Agent', 'Mozilla/5.0');
      expect(res.status).toBe(200);
    });

    test('le message 429 indique de réessayer dans 1 minute', async () => {
      const ip = '192.168.52.52';
      const results = await Promise.all(
        Array.from({ length: 155 }, () =>
          request(server)
            .get('/test')
            .set('x-forwarded-for', ip)
            .set('User-Agent', 'Mozilla/5.0')
        )
      );
      const blockedRes = results.find(r => r.status === 429);
      expect(blockedRes).toBeDefined();
      expect(blockedRes.body.message).toMatch(/1 minute/i);
    });
  });

  // ── 3. Path Traversal ───────────────────────────────────────────────────
  // Utilise des requêtes HTTP brutes car les clients HTTP normaux normalisent
  // `/../` → `/` avant l'envoi. Un attaquant utilise des outils bas niveau.
  describe('3 — Path Traversal', () => {
    const traversalPaths = [
      ['double-point slash',  '/../etc/passwd'],
      ['double-point encodé', '/%2e%2e%2fetc%2fpasswd'],
      ['anti-slash Windows',  '/test/..\\windows\\system32'],
      ['encodage mixte',      '/%2e%2e/etc/shadow'],
      ['double encodage',     '/%252e%252e%252fetc'],
    ];

    test.each(traversalPaths)('bloque path traversal : %s', async (_, path) => {
      const res = await rawGet(server, path);
      expect(res.status).toBe(400);
    });

    test('laisse passer un chemin normal', async () => {
      const res = await rawGet(server, '/test', '10.0.2.2');
      expect(res.status).toBe(200);
    });
  });

  // ── 4. Payload surdimensionné ───────────────────────────────────────────
  describe('4 — Payload Anormal', () => {
    test('bloque content-length > 2 MB', async () => {
      const res = await request(server)
        .post('/test')
        .set('content-length', String(3 * 1024 * 1024))
        .set('x-forwarded-for', '20.0.1.1')
        .set('User-Agent', 'Mozilla/5.0');
      expect(res.status).toBe(413);
    });

    test('bloque 10 MB', async () => {
      const res = await request(server)
        .post('/test')
        .set('content-length', String(10 * 1024 * 1024))
        .set('x-forwarded-for', '20.0.2.2')
        .set('User-Agent', 'Mozilla/5.0');
      expect(res.status).toBe(413);
    });

    test('autorise un payload normal (< 2 MB)', async () => {
      const res = await request(server)
        .post('/test')
        .set('x-forwarded-for', '20.0.3.3')
        .set('User-Agent', 'Mozilla/5.0')
        .send({ name: 'Jean Dupont' });
      expect(res.status).toBe(200);
    });
  });

  // ── 5. Injection ────────────────────────────────────────────────────────
  describe('5 — Injection', () => {

    describe('NoSQL Injection', () => {
      test.each([
        ['opérateur $where dans une valeur',  { search: "$where this.pass.length > 0" }],
        ['opérateur $ne dans une valeur',     { filter: "check $ne null" }],
        ['opérateur $regex dans une valeur',  { query: "pattern $regex .*admin.*" }],
        ['opérateur $or dans une valeur',     { input: "a $or b" }],
        ['opérateur $gt dans une valeur',     { condition: "age $gt 18" }],
      ])('bloque %s', async (_, body) => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.1.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send(body);
        expect(res.status).toBe(400);
      });

      test('bloque $ne dans les query params', async () => {
        const res = await request(server)
          .get('/test?search=$ne+null')
          .set('x-forwarded-for', '30.1.2.1')
          .set('User-Agent', 'Mozilla/5.0');
        expect(res.status).toBe(400);
      });
    });

    describe('SQL Injection', () => {
      test.each([
        ['SELECT',  "1' OR SELECT * FROM users--"],
        ['UNION',   "1 UNION SELECT username, password FROM users"],
        ['DROP',    "'; DROP TABLE users; --"],
        ['INSERT',  "'; INSERT INTO users VALUES ('hack','hack')--"],
        ['EXEC',    "'; EXEC xp_cmdshell('dir')--"],
      ])('bloque SQL "%s"', async (_, input) => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.2.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ input });
        expect(res.status).toBe(400);
      });
    });

    describe('XSS — Cross-Site Scripting', () => {
      test.each([
        ['balise <script>',      '<script>alert(1)</script>'],
        ['protocole javascript', 'javascript:alert(document.cookie)'],
        ['handler onerror',      '<img src=x onerror=alert(1)>'],
        ['balise <iframe>',      '<iframe src="https://evil.com">'],
        ['balise <svg>',         '<svg onload=alert(1)>'],
      ])('bloque XSS : %s', async (_, input) => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.3.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ data: input });
        expect(res.status).toBe(400);
      });

      test('bloque XSS dans les query params', async () => {
        const res = await request(server)
          .get('/test?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
          .set('x-forwarded-for', '30.3.2.1')
          .set('User-Agent', 'Mozilla/5.0');
        expect(res.status).toBe(400);
      });
    });

    describe('Command Injection', () => {
      test.each([
        ['point-virgule + cat',  '; cat /etc/passwd'],
        ['pipe + whoami',        '| whoami'],
        ['esperluette + ls',     '& ls -la'],
        ['pipe + bash',          '| bash -i'],
      ])('bloque injection commande : %s', async (_, cmd) => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.4.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ cmd });
        expect(res.status).toBe(400);
      });
    });

    describe('Code Injection', () => {
      test.each([
        ['eval()',      'eval(require("child_process").execSync("id"))'],
        ['exec()',      'exec("rm -rf /")'],
        ['system()',    'system("reboot")'],
        ['passthru()',  'passthru("cat /etc/shadow")'],
      ])('bloque injection code : %s', async (_, code) => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.5.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ code });
        expect(res.status).toBe(400);
      });
    });

    describe('Injection imbriquée (deepScan)', () => {
      test('détecte injection dans un objet imbriqué', async () => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.6.1.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ user: { profile: { bio: '<script>alert(1)</script>' } } });
        expect(res.status).toBe(400);
      });

      test('détecte injection dans un tableau', async () => {
        const res = await request(server)
          .post('/test')
          .set('x-forwarded-for', '30.6.2.1')
          .set('User-Agent', 'Mozilla/5.0')
          .send({ tags: ['sport', '; cat /etc/passwd', 'music'] });
        expect(res.status).toBe(400);
      });
    });

    test('envoie une alerte email pour injection NoSQL', async () => {
      await request(server)
        .post('/test')
        .set('x-forwarded-for', '30.9.9.1')
        .set('User-Agent', 'Mozilla/5.0')
        .send({ input: "$ne null $or admin" });
      expect(sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'NoSQL Injection' })
      );
    });
  });

  // ── 6. Méthodes HTTP non autorisées ────────────────────────────────────
  describe('6 — Méthodes HTTP non autorisées', () => {
    test('bloque la méthode TRACE', done => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/test',
          method: 'TRACE',
          headers: { 'x-forwarded-for': '40.0.1.1', 'user-agent': 'Mozilla/5.0', connection: 'close' },
        },
        res => {
          expect(res.statusCode).toBe(405);
          res.resume(); // Consomme le body pour libérer la connexion
          done();
        }
      );
      req.on('error', done);
      req.end();
    });

    const allowedMethods = [
      ['GET',    () => request(server).get('/test')],
      ['POST',   () => request(server).post('/test')],
      ['PUT',    () => request(server).put('/test')],
      ['DELETE', () => request(server).delete('/test')],
      ['PATCH',  () => request(server).patch('/test')],
    ];

    test.each(allowedMethods)('autorise la méthode %s', async (_, makeReq) => {
      const res = await makeReq()
        .set('x-forwarded-for', `40.${Math.floor(Math.random() * 200) + 1}.1.1`)
        .set('User-Agent', 'Mozilla/5.0');
      expect(res.status).toBe(200);
    });
  });

  // ── 7. Brute Force ──────────────────────────────────────────────────────
  describe('7 — Brute Force', () => {
    test('déclenche une alerte après 8 tentatives de login échouées', async () => {
      const ip = '50.0.0.50';
      for (let i = 0; i < 8; i++) {
        await request(server)
          .post('/login')
          .set('x-forwarded-for', ip)
          .set('User-Agent', 'Mozilla/5.0')
          .send({ email: 'victime@test.com', password: 'mauvais_mdp' });
      }
      await new Promise(resolve => setImmediate(resolve));
      expect(sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({ ip, type: 'Brute Force' })
      );
    });

    test('déclenche une alerte sur forgot-password répété', async () => {
      const ip = '50.1.0.50';
      for (let i = 0; i < 8; i++) {
        await request(server)
          .post('/forgot-password')
          .set('x-forwarded-for', ip)
          .set('User-Agent', 'Mozilla/5.0')
          .send({ email: 'personne@test.com' });
      }
      await new Promise(resolve => setImmediate(resolve));
      expect(sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({ ip, type: 'Brute Force' })
      );
    });

    test('le détail de l\'alerte mentionne le nombre de tentatives', async () => {
      const ip = '50.2.0.50';
      for (let i = 0; i < 8; i++) {
        await request(server)
          .post('/login')
          .set('x-forwarded-for', ip)
          .set('User-Agent', 'Mozilla/5.0')
          .send({ email: 'cible@test.com', password: 'wrong' });
      }
      await new Promise(resolve => setImmediate(resolve));
      expect(sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({ detail: expect.stringMatching(/tentatives/i) })
      );
    });
  });

});

// src/middleware/security.middleware.js
// Détecte 7 types d'attaques et envoie une alerte email à l'admin.
const { sendSecurityAlert } = require('../utils/email');

// ── Stores en mémoire ─────────────────────────────────────────────────────────
const requestCounts  = new Map(); // ip  → { count, resetAt }
const loginAttempts  = new Map(); // ip  → { count, resetAt }
const alertCooldowns = new Map(); // "ip:type" → lastAlertTimestamp

// ── Seuils ────────────────────────────────────────────────────────────────────
const RATE_MAX        = 150;           // requêtes/minute avant blocage
const RATE_WIN        = 60_000;
const BRUTE_MAX       = 8;             // échecs login/5 min avant alerte
const BRUTE_WIN       = 5 * 60_000;
const PAYLOAD_MAX     = 2 * 1024 * 1024; // 2 MB
const ALERT_COOLDOWN  = 10 * 60_000;  // 10 min entre deux alertes par (ip, type)

// ── Patterns d'attaque ────────────────────────────────────────────────────────
const PATTERNS = {
  'NoSQL Injection':    /\$where|\$ne|\$gt|\$lt|\$regex|\$or|\$and|\$in|\$nin/i,
  'SQL Injection':      /\b(select|insert|update|delete|drop|union|exec|xp_|sp_)\b/i,
  'Code Injection':     /\b(eval|exec|system|passthru|popen)\s*\(/i,
  'XSS':                /<script|javascript\s*:|on(error|load|click|mouse|focus)\s*=|<iframe|<svg\s/i,
  'Command Injection':  /[;&|`]\s*(ls|cat|pwd|whoami|id|uname|wget|curl|bash|sh)\b/i,
};
const PATH_TRAVERSAL_RE = /\.\.[\\/]|%2e%2e[%2f%5c]/i;
const SCANNER_RE        = /sqlmap|nikto|nmap|masscan|zgrab|nuclei|nessus|openvas|burpsuite|w3af|skipfish|dirbuster|gobuster|wfuzz|hydra|metasploit/i;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// Retourne true si on peut envoyer une alerte (cooldown respecté)
function canAlert(ip, type) {
  const key  = `${ip}:${type}`;
  const last = alertCooldowns.get(key) || 0;
  if (Date.now() - last > ALERT_COOLDOWN) {
    alertCooldowns.set(key, Date.now());
    return true;
  }
  return false;
}

async function triggerAlert(req, type, detail) {
  const ip = getIp(req);
  console.warn(`[SECURITY] ⚠️  ${type} — IP: ${ip} — ${detail}`);
  if (!canAlert(ip, type)) return;

  // Collecte les headers pertinents (sans exposer des secrets comme Authorization complet)
  const HEADER_KEYS = [
    'host', 'referer', 'origin', 'accept-language', 'content-type',
    'x-forwarded-for', 'x-real-ip', 'x-forwarded-proto', 'x-forwarded-host',
    'accept-encoding', 'connection', 'cookie',
  ];
  const relevantHeaders = {};
  for (const h of HEADER_KEYS) {
    if (req.headers[h]) {
      // Tronquer les cookies longs
      relevantHeaders[h] = h === 'cookie'
        ? req.headers[h].slice(0, 80) + (req.headers[h].length > 80 ? '…' : '')
        : req.headers[h];
    }
  }

  try {
    await sendSecurityAlert({
      ip,
      type,
      detail,
      method:    req.method,
      url:       req.originalUrl,
      protocol:  req.protocol || (req.socket?.encrypted ? 'https' : 'http'),
      hostname:  req.hostname || req.headers.host || '—',
      userAgent: req.headers['user-agent'] || '—',
      body:      JSON.stringify(req.body || {}).slice(0, 500),
      query:     Object.keys(req.query || {}).length
                   ? JSON.stringify(req.query, null, 2).slice(0, 400)
                   : null,
      headers:   relevantHeaders,
    });
  } catch (e) {
    console.error('[SECURITY] Échec envoi alerte email:', e.message);
  }
}

// Parcourt récursivement un objet et teste chaque string contre les patterns
function deepScan(obj, depth = 0) {
  if (depth > 6) return null;
  if (typeof obj === 'string') {
    for (const [type, re] of Object.entries(PATTERNS)) {
      if (re.test(obj)) return { type, value: obj.slice(0, 120) };
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) { const r = deepScan(v, depth + 1); if (r) return r; }
  } else if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) { const r = deepScan(v, depth + 1); if (r) return r; }
  }
  return null;
}

// ── Middleware principal ──────────────────────────────────────────────────────
module.exports = async function securityMiddleware(req, res, next) {
  const ip  = getIp(req);
  const now = Date.now();

  // ── 1. Scanner / outil d'audit connu ──────────────────────────────────────
  const ua = req.headers['user-agent'] || '';
  if (SCANNER_RE.test(ua)) {
    await triggerAlert(req, 'Scanner / Outil d\'audit', `User-Agent: ${ua}`);
    return res.status(403).json({ message: 'Forbidden' });
  }

  // ── 2. Rate limiting / DDoS ────────────────────────────────────────────────
  let rate = requestCounts.get(ip) || { count: 0, resetAt: now + RATE_WIN };
  if (now > rate.resetAt) { rate = { count: 0, resetAt: now + RATE_WIN }; }
  rate.count++;
  requestCounts.set(ip, rate);
  if (rate.count > RATE_MAX) {
    await triggerAlert(req, 'Rate Limit / DDoS', `${rate.count} requêtes en 1 minute`);
    return res.status(429).json({ message: 'Trop de requêtes — réessayez dans 1 minute' });
  }

  // ── 3. Path traversal ─────────────────────────────────────────────────────
  let decoded = req.originalUrl;
  try { decoded = decodeURIComponent(req.originalUrl); } catch {}
  if (PATH_TRAVERSAL_RE.test(decoded)) {
    await triggerAlert(req, 'Path Traversal', `URL: ${req.originalUrl}`);
    return res.status(400).json({ message: 'Requête invalide' });
  }

  // ── 4. Payload trop volumineux ─────────────────────────────────────────────
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > PAYLOAD_MAX) {
    await triggerAlert(req, 'Payload Anormal', `Taille: ${(contentLength / 1024).toFixed(0)} KB`);
    return res.status(413).json({ message: 'Payload trop volumineux' });
  }

  // ── 5. Injection (body + query params) ────────────────────────────────────
  const bodyHit  = deepScan(req.body);
  const queryHit = deepScan(req.query);
  const hit      = bodyHit || queryHit;
  if (hit) {
    const source = bodyHit ? 'Body' : 'Query';
    await triggerAlert(req, hit.type, `${source}: ${hit.value}`);
    return res.status(400).json({ message: 'Contenu de la requête invalide' });
  }

  // ── 6. Brute force — interception des réponses auth ───────────────────────
  const isAuthRoute = req.path === '/login' || req.path === '/forgot-password';
  if (isAuthRoute) {
    const origJson = res.json.bind(res);
    res.json = async function (data) {
      if (res.statusCode === 401 || res.statusCode === 404) {
        let entry = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + BRUTE_WIN };
        if (Date.now() > entry.resetAt) { entry = { count: 0, resetAt: Date.now() + BRUTE_WIN }; }
        entry.count++;
        loginAttempts.set(ip, entry);
        if (entry.count >= BRUTE_MAX) {
          // Appel fire-and-forget pour ne pas bloquer la réponse
          triggerAlert(req, 'Brute Force', `${entry.count} tentatives d'authentification échouées`);
        }
      }
      return origJson(data);
    };
  }

  // ── 7. Méthodes HTTP non autorisées ───────────────────────────────────────
  const ALLOWED = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
  if (!ALLOWED.includes(req.method)) {
    await triggerAlert(req, 'Méthode HTTP Suspecte', `Méthode: ${req.method}`);
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  next();
};

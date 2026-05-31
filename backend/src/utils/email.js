// src/utils/email.js — Resend API
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'ByMap <noreply@bymap.abrdns.com>';

/**
 * Envoie un OTP par e-mail.
 * @param {string} to     - Adresse destinataire
 * @param {string} code   - Code à 6 chiffres
 * @param {'register'|'reset'} type
 */
exports.sendOtpEmail = async (to, code, type) => {
  const isReset = type === 'reset';

  const subject = isReset
    ? '🔑 Réinitialisation de votre mot de passe ByMap'
    : '✅ Vérifiez votre adresse e-mail ByMap';

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#F2F5F3;font-family:Arial,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#2DBD7E,#22A06B);padding:28px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;letter-spacing:-0.5px;">ByMap</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
            ${isReset ? 'Réinitialisation de mot de passe' : 'Vérification du compte'}
          </p>
        </div>

        <!-- Body -->
        <div style="padding:32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">${isReset ? '🔑' : '✅'}</div>
          <h2 style="margin:0 0 10px;color:#1A1A2E;font-size:20px;">
            ${isReset ? 'Votre code de réinitialisation' : 'Votre code de vérification'}
          </h2>
          <p style="margin:0 0 24px;color:#4B5563;font-size:14px;line-height:1.5;">
            ${isReset
              ? 'Utilisez ce code pour réinitialiser votre mot de passe ByMap.'
              : 'Utilisez ce code pour confirmer votre adresse e-mail et créer votre compte ByMap.'}
          </p>

          <!-- Code box -->
          <div style="display:inline-block;background:#F0FDF4;border:2px solid #2DBD7E;border-radius:16px;padding:20px 40px;margin-bottom:24px;">
            <span style="font-size:40px;font-weight:900;color:#2DBD7E;letter-spacing:10px;">${code}</span>
          </div>

          <p style="margin:0 0 8px;color:#9CA3AF;font-size:13px;">
            Ce code expire dans <strong style="color:#1A1A2E;">10 minutes</strong>.
          </p>
          <p style="margin:0;color:#D1D5DB;font-size:11px;">
            Si vous n'avez pas demandé ce code, ignorez cet e-mail.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#F9FAFB;padding:16px;text-align:center;border-top:1px solid #F0F0F0;">
          <p style="margin:0;color:#9CA3AF;font-size:11px;">© 2025 ByMap — Tunisie</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({ from: FROM, to, subject, html });
};

/**
 * Envoie une alerte de sécurité détaillée à l'administrateur.
 * @param {{ ip, type, detail, method, url, protocol, hostname, userAgent, body, query, headers }} info
 */
exports.sendSecurityAlert = async ({
  ip, type, detail, method, url,
  protocol = 'http', hostname = '—', userAgent,
  body, query, headers = {},
}) => {
  const ADMIN_EMAIL = 'sakr.aafy@gmail.com';
  const now = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const SEVERITY = {
    'Brute Force':              { level: 'CRITIQUE',  color: '#EF4444', icon: '🔴' },
    'Code Injection':           { level: 'CRITIQUE',  color: '#DC2626', icon: '🔴' },
    'Command Injection':        { level: 'CRITIQUE',  color: '#DC2626', icon: '🔴' },
    'NoSQL Injection':          { level: 'ÉLEVÉ',     color: '#8B5CF6', icon: '🟠' },
    'SQL Injection':            { level: 'ÉLEVÉ',     color: '#8B5CF6', icon: '🟠' },
    'XSS':                      { level: 'ÉLEVÉ',     color: '#EC4899', icon: '🟠' },
    'Rate Limit / DDoS':        { level: 'ÉLEVÉ',     color: '#F97316', icon: '🟠' },
    'Path Traversal':           { level: 'MOYEN',     color: '#F59E0B', icon: '🟡' },
    'Scanner / Outil d\'audit': { level: 'MOYEN',     color: '#6366F1', icon: '🟡' },
    'Payload Anormal':          { level: 'FAIBLE',    color: '#F97316', icon: '🔵' },
    'Méthode HTTP Suspecte':    { level: 'FAIBLE',    color: '#F59E0B', icon: '🔵' },
  };
  const sev   = SEVERITY[type] || { level: 'INCONNU', color: '#EF4444', icon: '⚪' };
  const color = sev.color;

  // Ligne de table réutilisable
  const row = (label, val, mono = false) => val ? `
    <tr>
      <td style="padding:7px 12px 7px 0;color:#64748B;font-size:11px;white-space:nowrap;
                 vertical-align:top;width:130px;text-transform:uppercase;letter-spacing:.5px;">
        ${label}
      </td>
      <td style="padding:7px 0;color:#E2E8F0;font-size:${mono ? '12' : '13'}px;
                 word-break:break-all;${mono ? 'font-family:monospace;' : ''}">
        ${val}
      </td>
    </tr>` : '';

  // Headers HTTP formatés
  const headersHtml = Object.entries(headers).length
    ? Object.entries(headers).map(([k, v]) =>
        `<tr>
          <td style="padding:4px 10px 4px 0;color:#64748B;font-size:11px;font-family:monospace;
                     white-space:nowrap;vertical-align:top;">${k}</td>
          <td style="padding:4px 0;color:#A5B4FC;font-size:11px;font-family:monospace;
                     word-break:break-all;">${v}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="2" style="color:#475569;font-size:11px;padding:4px 0;">Aucun header supplémentaire</td></tr>`;

  const fullUrl = `${protocol}://${hostname}${url}`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0F172A;font-family:Arial,sans-serif;">
<div style="max-width:620px;margin:32px auto;border-radius:16px;overflow:hidden;border:1px solid #1E293B;">

  <!-- ── HEADER ── -->
  <div style="background:${color};padding:22px 28px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:middle;">
        <span style="font-size:32px;line-height:1;">🚨</span>
      </td>
      <td style="vertical-align:middle;padding-left:14px;">
        <div style="color:#fff;font-size:19px;font-weight:900;letter-spacing:-.3px;">
          Alerte Sécurité — ByMap
        </div>
        <div style="color:rgba(255,255,255,.85);font-size:12px;margin-top:4px;">${now}</div>
      </td>
      <td style="vertical-align:middle;text-align:right;">
        <span style="background:rgba(0,0,0,.25);color:#fff;font-size:11px;font-weight:700;
                     padding:4px 10px;border-radius:999px;letter-spacing:.5px;">
          ${sev.icon} ${sev.level}
        </span>
      </td>
    </tr></table>
  </div>

  <!-- ── TYPE D'ATTAQUE ── -->
  <div style="background:#1E293B;padding:16px 28px;border-bottom:1px solid #334155;">
    <div style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1px;
                margin-bottom:4px;">Type d'attaque détecté</div>
    <div style="color:${color};font-size:24px;font-weight:900;">${type}</div>
    <div style="color:#CBD5E1;font-size:13px;margin-top:6px;">
      <strong style="color:#94A3B8;">Détail :</strong> ${detail}
    </div>
  </div>

  <!-- ── SOURCE DE L'ATTAQUE ── -->
  <div style="background:#0F172A;padding:20px 28px;border-bottom:1px solid #1E293B;">
    <div style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1px;
                margin-bottom:12px;">Source de l'attaque</div>
    <table style="width:100%;border-collapse:collapse;">
      ${row('🌐 Adresse IP',
        `<strong style="color:#F87171;font-size:16px;font-family:monospace;">${ip}</strong>`)}
      ${row('📡 Méthode HTTP',
        `<span style="background:${color};color:#fff;padding:2px 10px;border-radius:4px;
                      font-size:12px;font-weight:700;">${method}</span>`)}
      ${row('🔗 URL cible', fullUrl, true)}
      ${row('🖥 User-Agent', userAgent)}
    </table>
  </div>

  <!-- ── PARAMÈTRES DE REQUÊTE ── -->
  ${query ? `
  <div style="background:#0F172A;padding:16px 28px;border-bottom:1px solid #1E293B;">
    <div style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1px;
                margin-bottom:8px;">Query Parameters</div>
    <div style="background:#1E293B;border-radius:8px;padding:12px 14px;
                border-left:3px solid #F59E0B;">
      <code style="color:#FCD34D;font-size:12px;white-space:pre-wrap;word-break:break-all;">
        ${query}
      </code>
    </div>
  </div>` : ''}

  <!-- ── BODY DE LA REQUÊTE ── -->
  ${body && body !== '{}' ? `
  <div style="background:#0F172A;padding:16px 28px;border-bottom:1px solid #1E293B;">
    <div style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1px;
                margin-bottom:8px;">Body de la requête</div>
    <div style="background:#1E293B;border-radius:8px;padding:12px 14px;
                border-left:3px solid ${color};">
      <code style="color:#A5B4FC;font-size:12px;white-space:pre-wrap;word-break:break-all;">
        ${body}
      </code>
    </div>
  </div>` : ''}

  <!-- ── HEADERS HTTP ── -->
  <div style="background:#0F172A;padding:16px 28px;border-bottom:1px solid #1E293B;">
    <div style="color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:1px;
                margin-bottom:8px;">Headers HTTP reçus</div>
    <div style="background:#1E293B;border-radius:8px;padding:12px 14px;">
      <table style="width:100%;border-collapse:collapse;">${headersHtml}</table>
    </div>
  </div>

  <!-- ── FOOTER ── -->
  <div style="background:#1E293B;padding:14px 28px;text-align:center;border-top:1px solid #334155;">
    <p style="margin:0;color:#475569;font-size:11px;">
      ByMap Security Monitor — Alerte automatique · Ne pas répondre à cet email.
    </p>
  </div>

</div>
</body>
</html>`;

  await resend.emails.send({
    from:    FROM,
    to:      ADMIN_EMAIL,
    subject: `🚨 [ByMap] ${sev.level} — ${type} depuis ${ip}`,
    html,
  });
};

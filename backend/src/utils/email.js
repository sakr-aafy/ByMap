// src/utils/email.js — Resend email service
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = 'ByMap <onboarding@resend.dev>';

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

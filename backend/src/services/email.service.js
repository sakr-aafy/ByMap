// src/services/email.service.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App Password Gmail (pas le mot de passe du compte)
  },
});

/**
 * Génère un code numérique à 6 chiffres
 */
exports.generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Envoie un code de vérification par email
 * @param {string} to    - Adresse email du destinataire
 * @param {string} code  - Code à 6 chiffres
 */
exports.sendVerificationEmail = async (to, code) => {
  await transporter.sendMail({
    from: `"ByMap" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Vérification de votre compte ByMap',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1d4ed8;margin-bottom:8px;">ByMap</h2>
        <p style="color:#374151;font-size:15px;">Bonjour,</p>
        <p style="color:#374151;font-size:15px;">
          Voici votre code de vérification. Il est valable pendant
          <strong>10 minutes</strong>.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <span style="display:inline-block;letter-spacing:10px;font-size:36px;font-weight:bold;color:#1d4ed8;background:#eff6ff;padding:16px 28px;border-radius:10px;">
            ${code}
          </span>
        </div>
        <p style="color:#6b7280;font-size:13px;">
          Si vous n'avez pas créé de compte ByMap, ignorez cet email.
        </p>
      </div>
    `,
  });
};

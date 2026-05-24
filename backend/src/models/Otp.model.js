// src/models/Otp.model.js
const { Schema, model } = require('mongoose');

const otpSchema = new Schema({
  email:     { type: String, required: true, lowercase: true, trim: true },
  code:      { type: String, required: true },
  type:      { type: String, enum: ['register', 'reset'], required: true },
  expiresAt: { type: Date, required: true },
});

// MongoDB TTL index — supprime automatiquement les documents expirés
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Otp', otpSchema);

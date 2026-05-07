const mongoose = require('mongoose');

const LocaliteSchema = new mongoose.Schema(
  {
    gouvernorat: { type: String, required: true, trim: true },
    delegation:  { type: String, required: true, trim: true },
    localite:    { type: String, required: true, trim: true },
    cp:          { type: String, trim: true, default: '' },
    lat:         { type: Number, required: true },
    lng:         { type: Number, required: true },
  },
  { timestamps: false }
);

// Index composé pour les requêtes de cascade rapides
LocaliteSchema.index({ gouvernorat: 1 });
LocaliteSchema.index({ gouvernorat: 1, delegation: 1 });

module.exports = mongoose.model('Localite', LocaliteSchema);

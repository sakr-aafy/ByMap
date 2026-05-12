const mongoose = require('mongoose');

const ZoneSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    pays:        { type: String, trim: true, default: '' },
    gouvernorat: { type: String, trim: true, default: '' },
    ville:       { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    categorie:   { type: String, trim: true, default: '' },
    lat:         { type: Number, required: true },
    lng:         { type: Number, required: true },
    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', ZoneSchema);

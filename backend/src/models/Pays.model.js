const mongoose = require('mongoose');

const CitySchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    region:     { type: String, trim: true, default: '' },
    population: { type: Number, default: 0 },
  },
  { _id: false }
);

const PaysSchema = new mongoose.Schema(
  {
    code:          { type: String, required: true, trim: true }, // alpha2: DZ, FR…
    name:          { type: String, required: true, trim: true },
    name_fr:       { type: String, trim: true, default: '' },
    official_name: { type: String, trim: true, default: '' },
    capital:       { type: String, trim: true, default: '' },
    flag:          { type: String, trim: true, default: '' },
    population:    { type: Number, default: 0 },
    area_km2:      { type: Number, default: 0 },
    continent:     { type: String, trim: true, default: '' },
    region:        { type: String, trim: true, default: '' },
    phone_code:    { type: String, trim: true, default: '' },
    coordinates: {
      latitude:  { type: Number, default: 0 },
      longitude: { type: Number, default: 0 },
    },
    cities: [CitySchema],
  },
  { timestamps: false }
);

PaysSchema.index({ code: 1 });

module.exports = mongoose.models.Pays || mongoose.model('Pays', PaysSchema);

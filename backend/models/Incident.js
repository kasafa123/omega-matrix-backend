const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  link: String,
  src: String,
  type: String,
  region: String,
  loc: String,
  coords: [Number],
  time: String,
  rawDate: Date,
  geofenced: Boolean,
  geofenceInfo: mongoose.Schema.Types.Mixed,
  createdBy: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Incident', IncidentSchema);
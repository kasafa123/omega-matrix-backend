const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  link: String,
  src: String,
  type: String, // war, emergency, normal, twitter, tiktok
  region: String,
  loc: String,
  coords: [Number], // [lat, lng]
  time: String,
  rawDate: Date,
  geofenced: { type: Boolean, default: false },
  geofenceInfo: {
    fence: { type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' },
    distance: Number
  },
  threatScore: Number,
  sentiment: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Incident', IncidentSchema);
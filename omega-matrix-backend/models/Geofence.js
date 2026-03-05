const mongoose = require('mongoose');

const GeofenceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  coords: [Number], // [lat, lng]
  radius: Number, // dalam km
  color: String,
  alerts: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Geofence', GeofenceSchema);
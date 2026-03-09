const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  link: String,
  src: String,
  type: {
    type: String,
    enum: ['war', 'emergency', 'twitter', 'tiktok', 'normal', 'news'],
    default: 'normal'
  },
  region: {
    type: String,
    enum: ['AM', 'EU', 'ME', 'AS', 'AF', 'OC', 'GL'],
    default: 'GL'
  },
  loc: String,
  coords: {
    lat: Number,
    lng: Number
  },
  rawDate: Date,
  geofenced: {
    type: Boolean,
    default: false
  },
  geofenceInfo: {
    fenceName: String,
    distance: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index untuk performa query
IncidentSchema.index({ createdAt: -1 });
IncidentSchema.index({ region: 1 });
IncidentSchema.index({ type: 1 });

module.exports = mongoose.model('Incident', IncidentSchema);
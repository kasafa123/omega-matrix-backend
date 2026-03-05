const express = require('express');
const Geofence = require('../models/Geofence');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all geofences
router.get('/', auth, async (req, res) => {
  try {
    const geofences = await Geofence.find();
    res.json(geofences);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new geofence
router.post('/', auth, async (req, res) => {
  try {
    const geofence = new Geofence({ ...req.body, createdBy: req.user.id });
    await geofence.save();
    res.status(201).json(geofence);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete geofence (admin or supervisor)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    await Geofence.findOneAndDelete({ id: req.params.id });
    res.json({ message: 'Geofence deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
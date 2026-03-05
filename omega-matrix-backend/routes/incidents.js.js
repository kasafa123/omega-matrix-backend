const express = require('express');
const Incident = require('../models/Incident');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all incidents (with optional limit)
router.get('/', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const incidents = await Incident.find().sort({ rawDate: -1 }).limit(limit);
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new incident
router.post('/', auth, async (req, res) => {
  try {
    const incident = new Incident(req.body);
    await incident.save();
    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete incident (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    await Incident.findOneAndDelete({ id: req.params.id });
    res.json({ message: 'Incident deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
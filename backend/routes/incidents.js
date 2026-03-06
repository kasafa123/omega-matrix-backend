const express = require('express');
const Incident = require('../models/Incident');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ rawDate: -1 }).limit(100);
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const incident = new Incident(req.body);
    const saved = await incident.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Incident.findOneAndDelete({ id: req.params.id });
    if (!result) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
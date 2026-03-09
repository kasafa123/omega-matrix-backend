const express = require('express');
const Incident = require('../models/Incident');
const { authMiddleware, authorize } = require('../middleware/auth');

const router = express.Router();

// Mendapatkan semua insiden (dengan pagination)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const incidents = await Incident.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Incident.countDocuments();

    res.json({
      incidents,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mendapatkan satu insiden berdasarkan ID
router.get('/:id', async (req, res) => {
  try {
    const incident = await Incident.findOne({ id: req.params.id });
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    res.json(incident);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Menyimpan insiden baru (hanya user terautentikasi)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const incidentData = req.body;
    
    // Cek apakah sudah ada
    const existing = await Incident.findOne({ id: incidentData.id });
    if (existing) {
      return res.status(400).json({ message: 'Incident already exists' });
    }

    // Konversi array koordinat ke object jika perlu
    if (incidentData.coords && Array.isArray(incidentData.coords)) {
      incidentData.coords = {
        lat: incidentData.coords[0],
        lng: incidentData.coords[1]
      };
    }

    const incident = new Incident(incidentData);
    await incident.save();
    
    res.status(201).json(incident);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Hapus insiden (khusus admin)
router.delete('/:id', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const incident = await Incident.findOneAndDelete({ id: req.params.id });
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }
    res.json({ message: 'Incident deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
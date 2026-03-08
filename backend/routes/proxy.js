const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Proxy untuk mengambil konten dari URL (misal RSS)
router.post('/fetch', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OmegaMatrixBot/1.0)'
      }
    });

    res.json({
      status: response.status,
      data: response.data,
      headers: response.headers
    });
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch URL',
      error: error.message 
    });
  }
});

module.exports = router;
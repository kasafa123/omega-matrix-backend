const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Koneksi MongoDB lokal
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Terhubung ke MongoDB lokal'))
  .catch(err => {
    console.error('❌ Gagal koneksi MongoDB:', err);
    process.exit(1);
  });

// Rute utama
app.get('/', (req, res) => {
  res.send('🚀 Server OMEGA MATRIX berjalan dengan database lokal!');
});

// API routes
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/auth', require('./routes/auth'));

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
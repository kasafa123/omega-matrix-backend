require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// === Error handling global (menangkap error tak terduga) ===
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  process.exit(1); // Keluar agar proses restart
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

const app = express();

// Middleware dasar
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cek environment variables (penting untuk debugging)
console.log('🔍 MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('🔍 JWT_SECRET exists:', !!process.env.JWT_SECRET);

// Koneksi ke MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Gagal total jika DB tidak bisa diakses
  });

// Routes yang benar-benar ada di folder routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));

// Endpoint health check sederhana
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Tangani route yang tidak ditemukan (404)
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const router = express.Router();

// REGISTRASI
router.post('/register', async (req, res) => {
  console.log('📥 Register request received');
  console.log('Body:', req.body);
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi' });
    }
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ username, password: hashedPassword, role });
    await user.save();
    console.log('✅ User registered:', username);
    res.status(201).json({ message: 'User berhasil dibuat' });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(400).json({ message: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  console.log('📥 Login request received');
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Username atau password salah' });
    }
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
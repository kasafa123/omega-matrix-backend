// Analisis sentimen sederhana
function analyzeSentiment(text) {
  const positiveWords = ['peace', 'ceasefire', 'agreement', 'success', 'victory'];
  const negativeWords = ['war', 'attack', 'kill', 'death', 'bomb', 'terror'];
  
  let score = 0;
  const lower = text.toLowerCase();
  
  positiveWords.forEach(word => {
    if (lower.includes(word)) score += 1;
  });
  negativeWords.forEach(word => {
    if (lower.includes(word)) score -= 2;
  });
  
  // Normalisasi ke 0-100
  return Math.max(0, Math.min(100, 50 + score * 10));
}

// Ekstraksi lokasi sederhana
function extractLocation(text) {
  const locations = ['gaza', 'ukraine', 'kyiv', 'moscow', 'beijing', 'washington', 'jerusalem'];
  for (const loc of locations) {
    if (text.toLowerCase().includes(loc)) {
      return loc.toUpperCase();
    }
  }
  return 'GLOBAL';
}

module.exports = { analyzeSentiment, extractLocation };
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon');
const geminiService = require('./services/gemini');
const tmdbService = require('./services/tmdb');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Cache reset endpoint
app.get('/reset-cache', (req, res) => {
  geminiService.clearCache();
  tmdbService.clearCache();
  res.send('✅ Caché local de Gemini y TMDB reiniciado. IMPORTANTE: Reinicia tu Stremio para forzar que borre su propio caché interno.');
});

// Serve the static configuration page at /configure
app.use('/configure', express.static(path.join(__dirname, 'public')));

// --- Individual field validation endpoints ---

// Validate Trakt username + client ID
app.post('/api/validate/trakt', async (req, res) => {
  const { trakt_username, trakt_client_id } = req.body;
  const axios = require('axios');
  if (!trakt_username || !trakt_client_id) return res.status(400).json({ error: 'Username and Client ID are required.' });
  try {
    await axios.get(`https://api.trakt.tv/users/${trakt_username}/profile`, {
      headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': trakt_client_id }
    });
    res.json({ success: true });
  } catch (e) {
    const status = e.response?.status;
    if (status === 404) return res.status(400).json({ error: 'Trakt user not found. Check your username.' });
    if (status === 401) return res.status(400).json({ error: 'Invalid Trakt Client ID.' });
    // 405 = profile is private, but credentials are valid
    if (status === 405) return res.json({ success: true, warning: 'Valid! (Your Trakt profile is set to Private, but the addon can still read your history.)' });
    res.status(400).json({ error: `Trakt validation failed (status ${status || 'unknown'}). Check both fields.` });
  }
});

// Validate TMDB API key
app.post('/api/validate/tmdb', async (req, res) => {
  const { tmdb_api_key } = req.body;
  const axios = require('axios');
  if (!tmdb_api_key) return res.status(400).json({ error: 'TMDB API Key is required.' });
  try {
    const isBearer = tmdb_api_key.length > 50;
    const headers = isBearer ? { Authorization: `Bearer ${tmdb_api_key}` } : {};
    const params = isBearer ? {} : { api_key: tmdb_api_key };
    await axios.get('https://api.themoviedb.org/3/authentication', { headers, params });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Invalid TMDB API Key.' });
  }
});

// Validate Gemini API key
app.post('/api/validate/gemini', async (req, res) => {
  const { gemini_api_key } = req.body;
  const axios = require('axios');
  if (!gemini_api_key) return res.status(400).json({ error: 'Gemini API Key is required.' });
  try {
    await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${gemini_api_key}`);
    res.json({ success: true });
  } catch (e) {
    const status = e.response?.status;
    if (status === 400 || status === 403) return res.status(400).json({ error: 'Invalid Gemini API Key.' });
    if (status === 429) return res.json({ success: true, warning: 'Key valid but quota is currently exhausted (free tier limit reached).' });
    res.status(400).json({ error: 'Gemini validation failed.' });
  }
});

// Bulk validation (called on form submit)
app.post('/api/validate', async (req, res) => {
  const { trakt_username, trakt_client_id, tmdb_api_key, gemini_api_key } = req.body;
  const axios = require('axios');
  
  try {
    // 1. Validate Trakt
    try {
      await axios.get(`https://api.trakt.tv/users/${trakt_username}/profile`, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': trakt_client_id
        }
      });
    } catch (e) {
      const status = e.response?.status;
      if (status === 404) {
        return res.status(400).json({ error: "Usuario de Trakt no encontrado." });
      }
      if (status !== 405) {
        return res.status(400).json({ error: "Trakt Client ID inválido o error de API." });
      }
      // If status === 405, we consider it valid (Private Profile) and continue to TMDB validation.
    }

    // 2. Validate TMDB
    try {
      const isBearer = tmdb_api_key.length > 50;
      const headers = isBearer ? { Authorization: `Bearer ${tmdb_api_key}` } : {};
      const params = isBearer ? {} : { api_key: tmdb_api_key };
      await axios.get(`https://api.themoviedb.org/3/authentication`, { headers, params });
    } catch (e) {
      return res.status(400).json({ error: "TMDB API Key inválido." });
    }

    // 3. Validate Gemini
    try {
      await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${gemini_api_key}`);
    } catch (e) {
      return res.status(400).json({ error: "Google Gemini API Key inválido o agotado." });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Validation error:", error.message);
    res.status(500).json({ error: "Error interno al validar las claves." });
  }
});

// Redirect root to /configure for users who visit the base URL
app.get('/', (req, res) => {
  res.redirect('/configure');
});

// Mount the Stremio Addon middleware
// Stremio supports arbitrary paths before /manifest.json
app.use(getRouter(addonInterface));

const PORT = parseInt(process.env.PORT || '7005', 10);

// Export app for Vercel serverless functions
module.exports = app;

// Only start the HTTP server when running locally (node server.js)
if (require.main === module) {
  const http = require('http');
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: El puerto ${PORT} ya está en uso por otro proceso.`);
      console.error(`   Cierra la otra terminal donde corre el servidor primero, o ejecuta:`);
      console.error(`   lsof -ti :${PORT} | xargs kill -9\n`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const localIp = Object.values(os.networkInterfaces())
      .flat()
      .find(i => i.family === 'IPv4' && !i.internal)?.address || 'TU_IP_LOCAL';

    console.log(`✅ Addon Configuration Page active on http://localhost:${PORT}/configure (Mac)`);
    console.log(`📺 To install on TV/Phone, open http://${localIp}:${PORT}/configure in that device's browser`);

    // --- DEBUG MODE (uncomment to print install link based on .env) ---
    // const { TRAKT_USERNAME, TRAKT_CLIENT_ID, TMDB_API_KEY, GEMINI_API_KEY } = process.env;
    // if (TRAKT_USERNAME && TRAKT_CLIENT_ID && TMDB_API_KEY && GEMINI_API_KEY) {
    //   const config = JSON.stringify({ trakt_username: TRAKT_USERNAME, trakt_client_id: TRAKT_CLIENT_ID, tmdb_api_key: TMDB_API_KEY, gemini_api_key: GEMINI_API_KEY });
    //   const encoded = encodeURIComponent(config);
    //   const rawUrl = `http://${localIp}:${PORT}/${encoded}/manifest.json`;
    //   const stremioUrl = rawUrl.replace(/^http:\/\//i, 'stremio://');
    //   console.log(`\n🐛 DEBUG - Link de instalación listo (basado en .env):`);
    //   console.log(`   Raw:     ${rawUrl}`);
    //   console.log(`   Stremio: ${stremioUrl}\n`);
    // }
    // --- END DEBUG MODE ---
  });
}


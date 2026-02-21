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

// Cache reset endpoint
app.get('/reset-cache', (req, res) => {
  geminiService.clearCache();
  tmdbService.clearCache();
  res.send('✅ Caché local de Gemini y TMDB reiniciado. IMPORTANTE: Reinicia tu Stremio para forzar que borre su propio caché interno.');
});

// Serve the static configuration page at /configure
app.use('/configure', express.static(path.join(__dirname, 'public')));

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


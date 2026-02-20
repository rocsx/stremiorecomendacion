const { addonBuilder } = require('stremio-addon-sdk');
const { getWatchedMovies, getWatchedShows } = require('./services/trakt');
const { getMovieRecommendations, getSeriesRecommendations } = require('./services/gemini');
const { searchMovie, searchSeries } = require('./services/tmdb');

// Define the Addon Manifest
const manifest = {
  id: 'org.gemini.recommender.dual.v2',
  version: '2.1.0',
  name: 'Gemini AI Recommender',
  description: 'Smart personalized recommendations for Movies and Series using your Trakt watch history and Google Gemini AI.',
  behaviorHints: {
    configurable: true,
    configurationRequired: true
  },
  types: ['movie', 'series'],
  catalogs: [
    {
      type: 'movie',
      id: 'gemini-movie-recommendations',
      name: 'Gemini AI Suggestions',
      extra: [
        { name: 'skip', isRequired: false },
        { name: 'genre', isRequired: false, options: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller'] }
      ],
    },
    {
      type: 'series',
      id: 'gemini-series-recommendations',
      name: 'Gemini AI Suggestions',
      extra: [
        { name: 'skip', isRequired: false },
        { name: 'genre', isRequired: false, options: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller'] }
      ],
    }
  ],
  resources: ['catalog'],
  idPrefixes: ['tt'], // Standard IMDb prefix
  // This 'config' array tells the Stremio SDK to register routes with /:config? prefix.
  // Without it, the URL /{json_config}/manifest.json returns 404.
  config: [
    { key: 'trakt_username', type: 'text', title: 'Trakt Username', required: true },
    { key: 'trakt_client_id', type: 'text', title: 'Trakt Client ID', required: true },
    { key: 'tmdb_api_key', type: 'text', title: 'TMDB API Key', required: true },
    { key: 'gemini_api_key', type: 'text', title: 'Gemini API Key', required: true },
  ],
};

const builder = new addonBuilder(manifest);

// Handle Catalog Requests
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
  // Extract user configuration from the Stremio install URL
  // (local .env fallback commented out — for debug use only)
  const userConfig = {
    trakt_username: config?.trakt_username, // || process.env.TRAKT_USERNAME,
    trakt_client_id: config?.trakt_client_id, // || process.env.TRAKT_CLIENT_ID,
    tmdb_api_key: config?.tmdb_api_key, // || process.env.TMDB_API_KEY,
    gemini_api_key: config?.gemini_api_key, // || process.env.GEMINI_API_KEY
  };

  // Only execute on the first page to avoid spamming the APIs
  const skip = extra.skip || 0;
  if (skip > 0) {
    return { metas: [] };
  }

  try {
    let history = [];
    let recommendations = [];
    let metas = [];

    if (type === 'movie' && id === 'gemini-movie-recommendations') {
      console.log('Fetching movie recommendations...');
      const traktData = await getWatchedMovies(userConfig);
      history = traktData.recent;
      const allWatched = traktData.allWatched;
      
      if (history.length > 0) {
        recommendations = await getMovieRecommendations(history, userConfig, allWatched, extra.genre);
        // Run all TMDB searches in PARALLEL (was serial - this saves ~10s on Vercel)
        const results = await Promise.all(
          recommendations.map(rec => searchMovie(rec.title, rec.year, userConfig))
        );
        metas = results.filter(Boolean);

        // RETRY: if TMDB returned 0, skip Trakt (already done) and ask Gemini for NEW recommendations
        if (metas.length === 0 && recommendations.length > 0) {
          console.log('⚠️ 0 results from TMDB. Retrying with fresh Gemini recommendations (Trakt skipped)...');
          const freshRecs = await getMovieRecommendations(history, userConfig, allWatched, extra.genre, true);
          const retryResults = await Promise.all(
            freshRecs.map(rec => searchMovie(rec.title, rec.year, userConfig))
          );
          metas = retryResults.filter(Boolean);
        }
      }
    } 
    else if (type === 'series' && id === 'gemini-series-recommendations') {
      console.log('Fetching series recommendations...');
      const traktData = await getWatchedShows(userConfig);
      history = traktData.recent;
      const allWatched = traktData.allWatched;
      
      if (history.length > 0) {
        recommendations = await getSeriesRecommendations(history, userConfig, allWatched, extra.genre);
        // Run all TMDB searches in PARALLEL (was serial - this saves ~10s on Vercel)
        const results = await Promise.all(
          recommendations.map(rec => searchSeries(rec.title, rec.year, userConfig))
        );
        metas = results.filter(Boolean);

        // RETRY: if TMDB returned 0, skip Trakt (already done) and ask Gemini for NEW recommendations
        if (metas.length === 0 && recommendations.length > 0) {
          console.log('⚠️ 0 results from TMDB. Retrying with fresh Gemini recommendations (Trakt skipped)...');
          const freshRecs = await getSeriesRecommendations(history, userConfig, allWatched, extra.genre, true);
          const retryResults = await Promise.all(
            freshRecs.map(rec => searchSeries(rec.title, rec.year, userConfig))
          );
          metas = retryResults.filter(Boolean);
        }
      }
    } else {
      return { metas: [] };
    }

    console.log(`Successfully prepared ${metas.length} ${type} items for Stremio.`);
    
    // Fallback: If APIs failed or returned nothing after retry, send a friendly error card
    if (metas.length === 0) {
      metas.push({
        id: `gemini-error-${Date.now()}`,
        type: type,
        name: 'Aviso Importante',
        poster: 'https://placehold.co/500x750/1a1d24/8b5cf6?text=Cargando...\\nOcurrio+un+Error',
        description: 'Google Gemini o Trakt no devolvieron resultados. Puede que tu historial sea muy corto, que las claves API sean incorrectas, o que Google Gemini esté sobrecargado en su plan gratuito. Por favor, intenta de nuevo en un par de minutos.',
        releaseInfo: 'Error',
      });
      // Short cache on error so Stremio retries quickly (5 min) instead of caching failure for 72hrs
      return { metas, cacheMaxAge: 5 * 60 };
    }

    // Return metas with cache headers (72 hours Cache Max Age) to prevent aggressive auto-refreshing
    return { 
      metas,
      cacheMaxAge: 72 * 60 * 60,       // Tells Stremio client to cache for 72 hours
      staleRevalidate: 24 * 60 * 60    // Can serve stale data while revalidating after 24 hours
    };

  } catch (error) {
    console.error(`Error serving ${type} catalog:`, error.message);
    return { metas: [] };
  }
});

module.exports = builder.getInterface();

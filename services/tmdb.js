const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const memoryCache = new Map();
const CACHE_TTL = 72 * 60 * 60 * 1000; // 72 hours in ms

function getCachedTmdb(key) {
  const cached = memoryCache.get(key);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  return null;
}

function setCachedTmdb(key, data) {
  // Prevent memory bloat by capping cache size to 500 TMDB items
  if (memoryCache.size >= 500) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { timestamp: Date.now(), data });
}

/**
 * Main search function for TMDB
 */
async function searchTmdb(title, year, type, userConfig) {
  const apiKey = userConfig?.tmdb_api_key;

  if (!apiKey) {
    console.error('TMDB API Key is missing in configuration');
    return null;
  }

  const cacheKey = `${type}_${title}_${year}`;
  const cachedData = getCachedTmdb(cacheKey);
  if (cachedData !== null) {
    // Note: cachedData might be explicitly false if not found cleanly
    return cachedData ? cachedData : null;
  }

  const isBearerToken = apiKey.length > 50; 
  const headers = isBearerToken ? { Authorization: `Bearer ${apiKey}` } : {};
  const searchParams = isBearerToken 
    ? { query: title, year: year, language: 'en-US' } 
    : { api_key: apiKey, query: title, year: year, language: 'en-US' };

  try {
    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
    
    // First try: search with year (more precise)
    let response = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, {
      params: searchParams,
      headers: headers
    });

    // Second try: search without year if first search returned no results
    // Gemini sometimes gives wrong years (e.g. season year vs premiere year)
    if (!response.data.results || response.data.results.length === 0) {
      const fallbackParams = isBearerToken 
        ? { query: title, language: 'en-US' }
        : { api_key: apiKey, query: title, language: 'en-US' };
      response = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, {
        params: fallbackParams,
        headers: headers
      });
    }

    const results = response.data.results;
    if (results && results.length > 0) {
      const item = results[0];
      
      const externalParams = isBearerToken ? {} : { api_key: apiKey };
      const externalEndpoint = type === 'series' ? `tv/${item.id}/external_ids` : `movie/${item.id}/external_ids`;
      const externalIdsResponse = await axios.get(
        `https://api.themoviedb.org/3/${externalEndpoint}`,
        {
          params: externalParams,
          headers: headers
        }
      );
      
      const imdbId = externalIdsResponse.data.imdb_id;
      
      if (!imdbId) {
        console.warn(`⚠️  TMDB: sin imdb_id para "${title}" (${year}) - será omitido`);
        setCachedTmdb(cacheKey, false); // Cache the failure
        return null;
      }

      const meta = {
        id: imdbId,
        type: type, // 'movie' or 'series'
        name: type === 'series' ? item.name : item.title,
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        background: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
        description: item.overview,
        releaseInfo: (type === 'series' ? item.first_air_date : item.release_date)?.substring(0, 4) || null,
      };

      setCachedTmdb(cacheKey, meta);
      return meta;
    }
    console.warn(`⚠️  TMDB: no se encontró "${title}" (${year}) en ninguna búsqueda`);
    setCachedTmdb(cacheKey, false);
    return null;
  } catch (error) {
    console.error(`Error searching TMDB for "${title}":`, error.message);
    return null;
  }
}

module.exports = {
  searchMovie: (title, year, config) => searchTmdb(title, year, 'movie', config),
  searchSeries: (title, year, config) => searchTmdb(title, year, 'series', config)
};

const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_USERNAME = process.env.TRAKT_USERNAME;

/**
/**
 * Fetches the user's recently watched tv shows from Trakt.tv and their full watched list
 * @param {Object} userConfig - User API keys {trakt_username, trakt_client_id}
 * @returns {Promise<Object>} {recent: Array, allWatched: Array}
 */
async function getWatchedShows(userConfig) {
  const username = userConfig?.trakt_username;
  const clientId = userConfig?.trakt_client_id;

  if (!clientId || !username) {
    console.error('Trakt credentials are missing in configuration');
    return { recent: [], allWatched: [] };
  }

  const headers = {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
  };

  // Only ask for history from the last 30 days to heavily optimize speed
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Get recent history to seed recommendations (last 30 days only)
    const historyResponse = await axios.get(
      `https://api.trakt.tv/users/${username}/history/shows?start_at=${thirtyDaysAgo}`,
      { headers }
    );
    
    // 2. Get the ENTIRE list of watched shows to build a solid deny-list 
    // We keep this full query to make sure we don't recommend ANYTHING ever watched
    const watchedResponse = await axios.get(
      `https://api.trakt.tv/users/${username}/watched/shows`,
      { headers }
    );

    const uniqueShows = [];
    const showIds = new Set();
    const allWatchedShowTitles = new Set();
    
    // Process full watched library for the deny list
    if (watchedResponse.data) {
      for (const item of watchedResponse.data) {
        if (item.show) {
          allWatchedShowTitles.add(item.show.title.toLowerCase().trim());
        }
      }
    }
    
    // Process recent history for the seed list
    if (historyResponse.data) {
      for (const item of historyResponse.data) {
        if (item.show) {
          // Fallback parsing into deny list just in case
          allWatchedShowTitles.add(item.show.title.toLowerCase().trim());
          
          if (!showIds.has(item.show.ids.trakt) && uniqueShows.length < 5) {
            showIds.add(item.show.ids.trakt);
            uniqueShows.push({
              title: item.show.title,
              year: item.show.year,
              trakt_id: item.show.ids.trakt,
              imdb_id: item.show.ids.imdb,
            });
          }
        }
      }
    }
    
    return { recent: uniqueShows, allWatched: Array.from(allWatchedShowTitles) };
  } catch (error) {
    console.error('Error fetching Trakt shows history:', error.message);
    return { recent: [], allWatched: [] };
  }
}

/**
 * Fetches the user's recently watched movies from Trakt.tv
 * @param {Object} userConfig - User API keys {trakt_username, trakt_client_id}
 * @returns {Promise<Object>} {recent: Array, allWatched: Array}
 */
async function getWatchedMovies(userConfig) {
  const username = userConfig?.trakt_username;
  const clientId = userConfig?.trakt_client_id;

  if (!clientId || !username) {
    console.error('Trakt credentials are missing in configuration');
    return { recent: [], allWatched: [] };
  }

  // Only ask for history from the last 30 days to heavily optimize speed
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const response = await axios.get(
      `https://api.trakt.tv/users/${username}/history/movies?start_at=${thirtyDaysAgo}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
        },
      }
    );

    // Extract all previously watched movies to avoid recommending them again
    const allWatchedMovieTitles = response.data.map(item => item.movie.title.toLowerCase().trim());

    // Return the last 5 watched movies metadata to seed Gemini
    const recentMovies = response.data.slice(0, 5).map(item => ({
      title: item.movie.title,
      year: item.movie.year,
      trakt_id: item.movie.ids.trakt,
      imdb_id: item.movie.ids.imdb,
    }));
    
    return { recent: recentMovies, allWatched: allWatchedMovieTitles };
  } catch (error) {
    console.error('Error fetching Trakt movie history:', error.message);
    return { recent: [], allWatched: [] };
  }
}

module.exports = {
  getWatchedShows,
  getWatchedMovies
};

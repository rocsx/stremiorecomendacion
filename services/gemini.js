const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const memoryCache = new Map();
const CACHE_TTL = 60 * 60 * 60 * 1000; // 60 hours in ms

/**
/**
 * Helper to get cached recommendations from memory
 */
function getCachedRecommendations(historyKey) {
  const cached = memoryCache.get(historyKey);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`Returning Gemini recommendations from memory cache for: ${historyKey}`);
    return cached.data;
  }
  return null;
}

/**
 * Helper to save to memory cache (with basic size limit)
 */
function setCachedRecommendations(historyKey, data) {
  // Prevent memory bloat on server by capping cache size to 100 recent unique requests
  if (memoryCache.size >= 100) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(historyKey, { timestamp: Date.now(), data });
}

/**
 * Generates recommendations using Gemini based on watch history
 * @param {Array} history - List of recently watched items (for seeding ideas)
 * @param {Object} userConfig - User API keys {gemini_api_key}
 * @param {string} type - 'movie' or 'series'
 * @param {Array} allWatchedTitles - List of all previous watched titles to exclude
 * @param {string} requestedGenre - Optional genre filter from Stremio UI
 * @returns {Promise<Array>} List of recommended titles and release years
 */
async function getRecommendations(history, userConfig, type, allWatchedTitles = [], requestedGenre = null, forceRefresh = false) {
  const apiKey = userConfig?.gemini_api_key;

  if (!apiKey) {
    console.error('Gemini API Key is missing in configuration');
    return [];
  }

  if (!history || history.length === 0) {
    return [];
  }

  const historyText = history.map(m => `${m.title} (${m.year})`).join(', ');
  
  // Cache key includes type and optional genre so movies and series don't collide
  const cacheKey = `${type}_${requestedGenre || 'all'}_${historyText}`;
  const cachedData = getCachedRecommendations(cacheKey);
  if (cachedData && !forceRefresh) {
    return cachedData;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const excludeList = allWatchedTitles.length > 0 ? `\nDo absolutely NOT include these specific titles you already know I watched:\n- ${allWatchedTitles.slice(0, 50).join('\n- ')}` : '';
  const genreInstruction = requestedGenre ? `ALL recommendations MUST strictly belong to the ${requestedGenre} genre.` : 'Consider shows with similar themes, genres, or actors.';
  const movieGenreInstruction = requestedGenre ? `ALL recommendations MUST strictly belong to the ${requestedGenre} genre.` : 'Consider movies with similar themes, genres, lead actors, or directors.';

  const prompt = type === 'series'
    ? `Based on the following TV series I recently watched:
    ${historyText}
    Recommend 10 popular, widely-known TV series I might like. ${genreInstruction}
    IMPORTANT: Only recommend well-known titles that are easy to find in databases like IMDB/TMDB.
    Do not include the series I already watched in your recommendations. ${excludeList}
    Output ONLY a JSON array of objects. No markdown, no explanations, just the raw JSON. Each object must have exactly two properties:
    - "title": The title of the TV series in English (string)
    - "year": The release year of the TV series (number)
    Example: [{"title": "Breaking Bad", "year": 2008}, {"title": "Stranger Things", "year": 2016}]`
    : `Based on the following movies I recently watched:
    ${historyText}
    Recommend 10 popular, widely-known movies I might like. ${movieGenreInstruction}
    IMPORTANT: Only recommend well-known titles that are easy to find in databases like IMDB/TMDB.
    Do not include the movies I already watched in your recommendations. ${excludeList}
    Output ONLY a JSON array of objects. No markdown, no explanations, just the raw JSON. Each object must have exactly two properties:
    - "title": The title of the movie in English (string)
    - "year": The release year of the movie (number)
    Example: [{"title": "Inception", "year": 2010}, {"title": "The Matrix", "year": 1999}]`;

  // Helper: call Gemini with a given model and return parsed JSON
  async function callGemini(modelName) {
    console.log(`Calling Gemini API for ${type} with ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    // Strip markdown code block delimiters that Gemini sometimes adds
    const cleanedText = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    return JSON.parse(cleanedText);
  }

  try {
    // Definimos la lista de modelos de mayor a menor calidad. 
    // Si uno da 429, probamos el siguiente automáticamente.
    const fallbackModels = [
      'gemini-2.5-flash',                // Mejor modelo (20 req/día gratis)
      'gemini-2.5-flash-lite',           // Variante ligera
      'gemini-2.0-flash-lite-001',       // Lite de versión 2.0
      'gemini-flash-lite-latest',        // El modelo lite global (para asegurar cuota)
      'gemini-pro-latest'                // Último cartucho
    ];

    let parsedData = null;
    let lastError = null;

    for (const modelName of fallbackModels) {
      try {
        parsedData = await callGemini(modelName);
        console.log(`✅ Success with model: ${modelName}`);
        break; // Éxito! Salimos del bucle
      } catch (err) {
        lastError = err;
        const is429 = err.message?.includes('429') || err.message?.includes('quota');
        if (is429) {
          console.warn(`⚠️ Model ${modelName} quota exceeded or unavailable. Trying next...`);
          continue; // Pasamos al siguiente modelo
        } else {
          // Si el error NO es por cuota/límites (es un error de red o de sintaxis general), detenemos aquí
          throw err;
        }
      }
    }

    if (!parsedData) {
      // Si llegamos hasta aquí, significa que probamos todos los modelos y todos fallaron por cuota
      console.error('❌ Todas las opciones de modelos fallaron por límite de cuota (429).');
      throw lastError;
    }

    setCachedRecommendations(cacheKey, parsedData);
    return parsedData;
  } catch (error) {
    console.error('Error generating recommendations with Gemini:', error.message);
    return [];
  }
}

module.exports = {
  getRecommendations,
  getMovieRecommendations: (h, config, a, genre, forceRefresh) => getRecommendations(h, config, 'movie', a, genre, forceRefresh),
  getSeriesRecommendations: (h, config, a, genre, forceRefresh) => getRecommendations(h, config, 'series', a, genre, forceRefresh),
  clearCache: () => memoryCache.clear()
};

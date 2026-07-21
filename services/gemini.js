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
 * Normalizes a title for reliable comparison (ignores case, accents and punctuation)
 */
function normalizeTitle(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
  if (cachedData && cachedData.length > 0 && !forceRefresh) {
    return cachedData;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const excludeList = allWatchedTitles.length > 0 ? `\nEXCLUSION LIST (I have ALREADY WATCHED all of these, comparison is case-insensitive — never recommend any of them):\n- ${allWatchedTitles.slice(0, 250).join('\n- ')}` : '';
  const genreInstruction = requestedGenre ? `ALL recommendations MUST strictly belong to the ${requestedGenre} genre.` : 'Consider shows with similar themes, genres, or actors.';
  const movieGenreInstruction = requestedGenre ? `ALL recommendations MUST strictly belong to the ${requestedGenre} genre.` : 'Consider movies with similar themes, genres, lead actors, or directors.';

  const prompt = type === 'series'
    ? `Based on the following TV series I recently watched:
    ${historyText}
    Recommend 20 TV series I might like but have NOT seen yet. ${genreInstruction}
    CRITICAL RULES YOU MUST FOLLOW:
    1. Every recommendation must be a real TV series that exists in IMDB/TMDB under the exact title and year you output.
    2. Prioritize critically acclaimed, high-quality productions over pure popularity to avoid low-rated content.
    3. ONLY recommend TV series with a TMDB/IMDB audience rating of 7.0 or strictly higher.
    4. ONLY recommend TV series released in the last 5 years.
    5. NEVER recommend anything I already watched: not the series listed in my recent history above, not anything in the exclusion list below, and no remakes, reboots or direct spin-offs of them either. ${excludeList}
    6. Give me FRESH discoveries: assume I already know the most obvious mega-hits related to my history, so mix a few acclaimed popular series with lesser-known hidden gems that still satisfy rules 1-4. Avoid repeating the same predictable picks that every recommendation engine suggests.
    Output ONLY a JSON array of objects. No markdown, no explanations, just the raw JSON. Each object must have exactly two properties:
    - "title": The title of the TV series in English (string)
    - "year": The release year of the TV series (number)
    Example: [{"title": "Severance", "year": 2022}, {"title": "The Last of Us", "year": 2023}]`
    : `Based on the following movies I recently watched:
    ${historyText}
    Recommend 20 movies I might like but have NOT seen yet. ${movieGenreInstruction}
    CRITICAL RULES YOU MUST FOLLOW:
    1. Every recommendation must be a real movie that exists in IMDB/TMDB under the exact title and year you output.
    2. Prioritize critically acclaimed, high-quality productions over pure popularity to avoid low-rated content.
    3. ONLY recommend movies with a TMDB/IMDB audience rating of 7.0 or strictly higher.
    4. ONLY recommend movies released in the last 5 years.
    5. NEVER recommend anything I already watched: not the movies listed in my recent history above, not anything in the exclusion list below, and no remakes, reboots or direct sequels of them either. ${excludeList}
    6. Give me FRESH discoveries: assume I already know the most obvious blockbusters related to my history, so mix a few acclaimed popular movies with lesser-known hidden gems that still satisfy rules 1-4. Avoid repeating the same predictable picks that every recommendation engine suggests.
    Output ONLY a JSON array of objects. No markdown, no explanations, just the raw JSON. Each object must have exactly two properties:
    - "title": The title of the movie in English (string)
    - "year": The release year of the movie (number)
    Example: [{"title": "Dune: Part Two", "year": 2024}, {"title": "Spider-Man: Across the Spider-Verse", "year": 2023}]`;

  // Helper: call Gemini with a given model and return parsed JSON
  async function callGemini(modelName) {
    console.log(`Calling Gemini API for ${type} with ${modelName}...`);
    // Higher temperature so repeated calls surface different titles instead of the same safe picks
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig: { temperature: 1.1 } });
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

    // Deterministic safety net: even if Gemini ignores the exclusion rules,
    // drop anything already watched and dedupe the recommendations themselves
    const watchedSet = new Set(allWatchedTitles.map(normalizeTitle));
    history.forEach(m => watchedSet.add(normalizeTitle(m.title)));
    const seenRecs = new Set();
    const filteredData = (Array.isArray(parsedData) ? parsedData : []).filter(rec => {
      if (!rec || !rec.title) return false;
      const key = normalizeTitle(rec.title);
      if (watchedSet.has(key) || seenRecs.has(key)) return false;
      seenRecs.add(key);
      return true;
    });
    const removedCount = (Array.isArray(parsedData) ? parsedData.length : 0) - filteredData.length;
    if (removedCount > 0) {
      console.log(`Filtered out ${removedCount} already-watched/duplicate ${type} recommendations from Gemini output.`);
    }

    // Never cache an empty list: it would pin the error card for the full TTL
    // instead of letting Stremio's 5-minute retry get a fresh attempt
    if (filteredData.length > 0) {
      setCachedRecommendations(cacheKey, filteredData);
    }
    return filteredData;
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

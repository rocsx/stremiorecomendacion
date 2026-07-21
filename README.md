# 🤖 Gemini AI Recommender — Stremio Addon

A smart, AI-powered Stremio addon that gives you highly personalized Movie and TV Show recommendations based on your unique watch history.

> 🏷️ **Current Version:** `v2.2.1` — See [CHANGELOG.md](file:///Users/a34578/Mis%20Apps/StremioRecomendacion/CHANGELOG.md) for full history.

This addon acts as your personal movie critic. It connects to your Trakt.tv account to read what you've been watching recently and then feeds that context into Google's Gemini AI. Gemini analyzes your taste—identifying your favorite genres, actors, directors, and themes—and generates a curated list of fresh recommendations just for you.

---

## ✨ Key Features

- **Hyper-Personalized Content:** Recommendations are dynamically generated based on your last 15–60 days of Trakt history.
- **Smart Filtering:** You can filter the AI's suggestions by specific genres (Action, Comedy, Drama, Horror, Sci-Fi, Romance, Thriller) directly from Stremio's Discover tab.
- **No Duplicates:** The AI cross-references your history to ensure it never recommends something you have already watched.
- **High Performance:** Searches run entirely in parallel and leverage an intelligent in-memory caching system to ensure extremely fast loading times without hitting rate limits.
- **Privacy-First (Bring Your Own Keys):** To run this addon, you configure it securely with your own free API keys (Trakt, TMDB, and Gemini). Your keys remain safely encoded in your personal Stremio installation URL and are never stored globally.

---

## ⚙️ How to Configure & Install

When you click "Configure", you will be asked to provide your own API keys for the services the addon uses. All of them are 100% free to get:

1. **Trakt:** Your public Username and a free Client ID from [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications).
2. **TMDB:** A free API key from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) to load posters and metadata.
3. **Google Gemini:** A free AI Studio API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) (provides thousands of free requests per day).

Simply fill out the configuration page, click "Install in Stremio", and let the AI find your next favorite movie!

---

## 📋 Changelog

### [2.2.1] - 2026-07-21
#### Added
- **Deterministic Exclusion Filter:** Added a server-side title normalization filter to fully strip out already-watched/history items and duplicate results, acting as a reliable fail-safe if the Gemini model misses the prompt instructions.
- **Improved Gemini Creativity:** Higher model temperature (`1.1`) and refined prompts to mix critically acclaimed hits with lesser-known "hidden gems", avoiding predictable suggestions.
- **Robust Trakt API Error Handling:** Graceful fallback to recent 15-day history when full library watched lists fail to fetch, preventing addon crashes.
- **Fail-safe Cache Management:** Prevent caching empty lists or error states locally to allow rapid retries by the Stremio client.

### [1.1.0] - 2026-03-15
#### Added
- **Interactive Configuration Page (`/configure`):**
  - Added individual "Verify" buttons for Trakt, TMDB, and Gemini API keys.
  - Added real-time inline validation feedback (visual cues and text) for each field.
- **Strict Data Validation:**
  - The "Generate Install Link" button is now strictly disabled until all three API credentials are independently validated and marked as correct.
  - Automatically resets field validation status if the user modifies an already verified input.

#### Changed
- **Smarter TMDB Fallbacks:** Ensure robust extraction of metadata and cover posters for recommendations.
- **Improved Trakt Integration:**
  - The extension now correctly handles `HTTP 405 (Method Not Allowed)` for Trakt users with Private Profiles. It flags it with a warning but correctly reads the history anyway.
  - Heavily optimized history tracking: reduced the Trakt fetch window from 60 days to **15 days**. This ensures the AI captures your current mood and watching habits without being polluted by older data.
- **Refined Gemini AI Prompts:**
  - **Quality over Quantity:** Instructed Gemini to prioritize critically acclaimed shows/movies and avoid generic or poorly-rated suggestions.
  - **Strict Rating Limit:** AI is now forced to exclusively recommend titles with a TMDB/IMDB audience score of **7.0 or higher**.
  - **Strict Recency Limit:** AI is now forced to exclusively recommend titles released in the last 5 years.

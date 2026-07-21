# Gemini AI Recommender for Stremio - Changelog

## [1.1.0] - 2026-03-15

### Added
- **Interactive Configuration Page (`/configure`)**:
  - Added individual "Verify" buttons for Trakt, TMDB, and Gemini API keys.
  - Added real-time inline validation feedback (visual cues and text) for each field.
- **Strict Data Validation**:
  - The "Generate Install Link" button is now strictly disabled until all three API credentials are independently validated and marked as correct.
  - Automatically resets field validation status if the user modifies an already verified input.

### Changed
- **Smarter TMDB Fallbacks**: Ensure robust extraction of metadata and cover posters for recommendations.
- **Improved Trakt Integration**:
  - The extension now correctly handles `HTTP 405 (Method Not Allowed)` for Trakt users with Private Profiles. It flags it with a yellow warning but correctly reads the history anyway.
  - Heavily optimized history tracking: reduced the Trakt fetch window from 60 days to **15 days**. This ensures the AI captures your *current* mood and watching habits without being polluted by older data.
- **Refined Gemini AI Prompts**:
  - **Quality over Quantity:** Instructed Gemini to prioritize critically acclaimed shows/movies and avoid generic or poorly-rated suggestions.
  - **Strict Rating Limit:** AI is now forced to exclusively recommend titles with a TMDB/IMDB audience score of **7.0 or higher**.
  - **Strict Recency Limit:** AI is now forced to exclusively recommend titles released in the **last 5 years** (2021-2026).

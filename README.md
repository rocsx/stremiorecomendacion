# 🤖 Gemini AI Recommender — Stremio Addon

Addon de Stremio que genera recomendaciones personalizadas de **películas y series** usando tu historial de Trakt.tv y la IA de Google Gemini.

---

## ✨ Características

- 🎬 Recomendaciones de películas y series basadas en tu historial reciente (últimos 60 días de Trakt)
- 🧠 Motor de IA: Google Gemini — entiende géneros, actores, directores y temáticas
- 🎭 **Filtros de género** en Stremio (Acción, Comedia, Drama, Terror, Sci-Fi, Romance, Thriller)
- 🚫 Nunca recomienda algo que ya hayas visto
- 🔐 Multi-usuario: cada persona instala el addon con sus propias API Keys
- ⚡ Caché en memoria de 60h (sin archivos en disco)

---

## 🔑 Credenciales necesarias

| Campo | Dónde obtenerlo |
|---|---|
| **Trakt Username** | Tu nombre de usuario en [trakt.tv](https://trakt.tv) |
| **Trakt Client ID** | Crea una app en [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications) |
| **TMDB API Key** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **Gemini API Key** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |

---

## 💻 Instalación y uso local

### 1. Clona e instala dependencias
```bash
git clone <tu-repo>
cd StremioRecomendacion
npm install
```

### 2. Configura el archivo `.env`
Crea un `.env` basándote en `.env.example`:
```env
GEMINI_API_KEY=tu_clave
TMDB_API_KEY=tu_clave
TRAKT_CLIENT_ID=tu_client_id
TRAKT_CLIENT_SECRET=tu_client_secret
TRAKT_USERNAME=tu_usuario
PORT=7005
```

### 3. Inicia el servidor
```bash
npm start
```

El servidor arranca en `http://localhost:7005/`. Abre esa URL desde tu celular o TV en la misma red local para configurar e instalar el addon en Stremio.

> Si el puerto 7005 ya está en uso, mátalo primero:
> ```bash
> lsof -ti :7005 | xargs kill -9
> ```

---

## 🗂️ Estructura del proyecto

```
├── server.js           # Servidor Express
├── addon.js            # Manifiesto y handlers del addon de Stremio
├── public/
│   └── index.html      # Página web de configuración
├── services/
│   ├── trakt.js        # Historial de Trakt (últimos 60 días)
│   ├── gemini.js       # Recomendaciones con Google Gemini AI
│   └── tmdb.js         # Metadatos y portadas desde TMDB
└── .env.example        # Plantilla de variables de entorno
```

---

## 📄 Licencia

MIT

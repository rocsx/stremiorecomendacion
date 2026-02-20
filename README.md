# 🤖 Gemini AI Recommender — Stremio Addon

Addon de Stremio que genera recomendaciones personalizadas de **películas y series** usando tu historial de Trakt.tv y la IA de Google Gemini.

🌐 **Demo en vivo:** [stremio-gemini-recommender.vercel.app](https://stremio-gemini-recommender.vercel.app)

---

## ✨ Características

- 🎬 Recomendaciones de películas y series basadas en tu historial reciente (últimos 30 días de Trakt)
- 🧠 Motor de IA: Google Gemini — entiende géneros, actores, directores y temáticas
- 🎭 **Filtros de género** en Stremio (Acción, Comedia, Drama, Terror, Sci-Fi, Romance, Thriller)
- 🚫 Nunca recomienda algo que ya hayas visto
- 🔐 Multi-usuario: cada persona instala el addon con sus propias API Keys (no hay claves del servidor)
- ⚡ Caché en memoria de 72h + caché del cliente Stremio (no consume disco)
- 🔄 Retry inteligente: si TMDB falla, reintenta con nuevas recomendaciones sin volver a llamar a Trakt

---

## 🚀 Instalación rápida (producción)

1. Abre [stremio-gemini-recommender.vercel.app](https://stremio-gemini-recommender.vercel.app) en tu navegador (también desde TV/celular)
2. Llena el formulario con tus credenciales
3. Pulsa **"Install in Stremio"** o copia el link y pégalo manualmente en Stremio → Addons → Add from URL

---

## 🔑 Credenciales necesarias

| Campo | Dónde obtenerlo |
|---|---|
| **Trakt Username** | Tu nombre de usuario en [trakt.tv](https://trakt.tv) |
| **Trakt Client ID** | Crea una app en [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications) |
| **TMDB API Key** | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) |
| **Gemini API Key** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |

---

## 💻 Desarrollo local

### 1. Clona el repositorio e instala dependencias
```bash
git clone <tu-repo>
cd StremioRecomendacion
npm install
```

### 2. Configura el archivo `.env`
Crea un archivo `.env` en la raíz basándote en `.env.example`:
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
El servidor arranca en `http://localhost:7005/`. Abre esa URL desde tu celular/TV en la misma red para instalar el addon de prueba.

> **Nota:** Si el puerto 7005 está en uso, mata el proceso primero:
> ```bash
> lsof -ti :7005 | xargs kill -9
> ```

---

## ☁️ Deploy en Vercel

```bash
npm install -g vercel
vercel login
vercel --prod --yes
```

El proyecto ya incluye `vercel.json` configurado. El addon se desplegará automáticamente.

---

## 🗂️ Estructura del proyecto

```
├── server.js           # Servidor Express (local + Vercel serverless)
├── addon.js            # Manifiesto y handlers del addon de Stremio
├── public/
│   └── index.html      # Página web de configuración
├── services/
│   ├── trakt.js        # Obtiene historial de Trakt (últimos 30 días)
│   ├── gemini.js       # Llama a Gemini AI para generar recomendaciones
│   └── tmdb.js         # Busca metadatos y portadas en TMDB
├── vercel.json         # Configuración de despliegue en Vercel
└── .env.example        # Plantilla de variables de entorno
```

---

## 📄 Licencia

MIT

# Running the Dev Server and Workers Separately

The dev server (Next.js on port 3000) and background workers (e.g. video processing) run in **separate processes**. The dev server uses **Webpack** (not Turbopack) for Windows compatibility and stability. Separating workers avoids resource issues that occurred when both were started together in one process.

---

## Run the dev server

From the `next-app` folder:

```cmd
npm run dev
```

Only Next.js uses port 3000. Open **http://localhost:3000** in your browser.

---

## Run the video worker

In **another terminal**, from the `next-app` folder:

```cmd
npm run worker:video
```

The worker polls for video jobs and processes them with:
- **Download (TikTok URL jobs)** – Uses **yt-dlp** to download the video (must be installed and on PATH). Install: `pip install yt-dlp` or download from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases).
- **OCR** – Extracts text from video frames (Tesseract, ffmpeg preprocessing)
- **Transcription** – Speech-to-text from audio (OpenAI Whisper) → stored in `transcript_text` (uses `OPENAI_AUDIO_TRANSCRIPTION_KEY`)
- **Recipe extraction** – AI combines OCR + transcript into structured recipe JSON (GPT-4.1 nano) → stored in `extracted_recipe` (uses `OPENAI_REASONING_API_KEY`)

It uses `.env.local` (e.g. `OPENAI_AUDIO_TRANSCRIPTION_KEY`, `OPENAI_REASONING_API_KEY`). See `.env.local.example`. For full system dependencies (ffmpeg, Tesseract, yt-dlp), see [VIDEO_UPLOAD_SETUP.md](VIDEO_UPLOAD_SETUP.md).

---

## Run both (separate processes)

- **Windows**: Double‑click `dev-all.bat` in the `next-app` folder, or from a terminal in `next-app` run `npm run dev:all`. This opens two windows: one for the dev server, one for the video worker.
- **Other OS**: Open two terminals; in one run `npm run dev`, in the other `npm run worker:video`.

Neither approach runs the worker inside the same process as the Next.js dev server.

---

## Stopping everything

Before leaving, stop servers to free ports and resources:

1. **Manual:** Press `Ctrl+C` in each terminal running `npm run dev` or `npm run worker:video`.
2. **PowerShell (ports 3000, 3001):**
   ```powershell
   Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
   ```
3. **Windows:** Close the terminal windows opened by `dev-all.bat`.

---

## Run the video worker with Docker (optional)

Use this when you want the same dependencies as production (no local ffmpeg/Tesseract/yt-dlp install). **Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)** for Windows or macOS first, then start Docker.

1. Ensure `next-app/.env.local` exists (copy from `.env.local.example` and fill in keys). Compose injects these into the container at runtime; they are not baked into the image.
2. From the **`HomeRecipe`** folder (parent of `next-app`), run:

```cmd
docker compose build video-worker
docker compose up -d video-worker
```

3. Follow logs:

```cmd
docker compose logs -f video-worker
```

To run **both** the recipe URL API and the video worker:

```cmd
docker compose up -d
```

To stop:

```cmd
docker compose down
```

The image is built from `next-app/Dockerfile.worker` and runs `npm run worker:video` inside Linux with **ffmpeg**, **Tesseract**, and **yt-dlp** preinstalled.

---

## Production (Vercel + worker hosting)

For **go-live**: deploy both Docker services on a container host (Railway, Fly.io, Render, VPS, etc.), set secrets there, and on **Vercel** set **`RECIPE_URL_IMPORT_API_URL`** to the **public HTTPS** base URL of the Python service (never `localhost`). Full steps, env var tables, and build contexts are in **[DEPLOY.md](../DEPLOY.md)** in the `HomeRecipe` folder.

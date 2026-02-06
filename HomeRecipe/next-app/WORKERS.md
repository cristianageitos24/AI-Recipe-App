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
- **OCR** – Extracts text from video frames (Tesseract, ffmpeg preprocessing)
- **Transcription** – Speech-to-text from audio (OpenAI Whisper) → stored in `transcript_text` (uses `OPENAI_AUDIO_TRANSCRIPTION_KEY`)
- **Recipe extraction** – AI combines OCR + transcript into structured recipe JSON (GPT-4.1 nano) → stored in `extracted_recipe` (uses `OPENAI_REASONING_API_KEY`)

It uses `.env.local` (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_AUDIO_TRANSCRIPTION_KEY`, `OPENAI_REASONING_API_KEY`). See `.env.local.example`.

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

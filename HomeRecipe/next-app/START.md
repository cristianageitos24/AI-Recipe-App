# How to Run the App

## 1. Open a terminal in the **next-app** folder

The terminal’s current directory must be `next-app` (where this file is). Not the parent `HomeRecipe` folder.

```cmd
cd "c:\Users\ChristianAgeitos\Documents\Almika Codes\Cursor\AI - Recipe App\HomeRecipe\next-app"
```

## 2. Start the dev server

```cmd
npm run dev
```

This starts **Next.js only** at **http://localhost:3000** using **Webpack** (Turbopack disabled for Windows compatibility). Port 3000 is used only by the dev server.

## 3. Open the app

In your browser go to: **http://localhost:3000**

---

## Video worker (optional)

To process video jobs (e.g. OCR from TikTok), run the worker in a **second terminal**. In that terminal, from the same `next-app` folder:

```cmd
npm run worker:video
```

See [WORKERS.md](WORKERS.md) for details and how to run both dev server and worker in separate windows (e.g. `dev-all.bat` on Windows).

---

## If something goes wrong

- **“Can’t resolve tailwindcss”**  
  You’re probably not in `next-app`. Close the terminal, `cd` into `next-app` again, then run `npm run dev`.

- **Worker: “Missing required environment variables”**  
  Create or fix `next-app/.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL  
  - `SUPABASE_SECRET_KEY` = your Supabase secret key  
  - `OPENAI_AUDIO_TRANSCRIPTION_KEY` = your OpenAI key (for audio transcription; optional but recommended)
  - `OPENAI_REASONING_API_KEY` = your OpenAI key (for AI recipe extraction from video; optional)  
  (See `.env.local.example` in the same folder.)

- **Worker: “Failed to claim job” / “fetch failed”**  
  Check that `.env.local` has the correct Supabase URL and key and that you can reach the internet. Restart the worker after changing env.

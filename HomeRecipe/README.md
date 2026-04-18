![HomeRecipeMockups](https://github.com/user-attachments/assets/05dc88a4-5d25-4509-88cb-bfbe2c0716ea)
![HomeRecipeTitle](https://github.com/user-attachments/assets/62a05a36-23c4-459e-8671-aa7d8402a923)

**HomeRecipe** is a fullstack web application that lets users search for recipes, save favorites, organize them in cookbooks, plan meals on a calendar, and optionally extract text from recipe videos (e.g. TikTok) via OCR.

## Stack

- **Next.js** (App Router, TypeScript) – UI and API in one codebase
- **Clerk** – Authentication (sign-in, sign-up, sessions)
- **Supabase** – PostgreSQL database and storage (RLS uses Clerk user IDs)
- **USDA FoodData Central** – Nutrition reference data (bulk CSV import + optional server-side API; see migrations and `npm run import:fdc`)
- **Open Recipes** – Optional recipe data import and search

## Features

- **User authentication**: Sign up and log in via Clerk.
- **Recipe search**: Find recipes (Open Recipes data on Home).
- **Save and organize**: Like recipes and save them to custom folders (cookbooks).
- **Meal planning**: Add recipes to a personal calendar (FullCalendar).
- **Video upload & OCR** (optional): Upload videos (e.g. TikTok), process with FFmpeg + Tesseract to extract recipe text.

---

## Prerequisites

- **Node.js 18+**  
  Install from [nodejs.org](https://nodejs.org/) or via your package manager.

- **Git**  
  To clone the repository.

- **System dependencies for video OCR** (only if you need video upload/processing):
  - **FFmpeg** – video frame extraction
  - **Tesseract** – OCR (optional; app can fall back to Tesseract.js)

  **Windows (Chocolatey):**
  ```powershell
  choco install ffmpeg tesseract -y
  ```
  **Windows (manual):**  
  Install [FFmpeg](https://www.gyan.dev/ffmpeg/builds/) and [Tesseract](https://github.com/UB-Mannheim/tesseract/wiki), then add their `bin` folders to your PATH.

  **macOS:**
  ```bash
  brew install ffmpeg tesseract
  ```
  **Linux:**
  ```bash
  sudo apt-get install ffmpeg tesseract-ocr
  ```

---

## Required accounts and services

### Clerk (authentication)

1. Create an account at [clerk.com](https://clerk.com) and create an application.
2. In the Clerk Dashboard, go to **API Keys** and copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
3. Configure redirect URLs (e.g. after sign-in: `http://localhost:3000/dashboard` for local dev).

### Supabase (database and storage)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API** you’ll find:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **publishable** key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client-side; respects RLS)
   - **secret** key → `SUPABASE_SECRET_KEY` (server/worker only; needed for video worker and import scripts; keep secret).
3. **Clerk integration:**  
   In Clerk Dashboard → [Supabase integration](https://dashboard.clerk.com/setup/supabase), activate and copy your Clerk domain.  
   In Supabase Dashboard → **Authentication** → **Sign In / Up** → **Add provider** → **Clerk** → paste the Clerk domain.  
   See [next-app/supabase/README.md](next-app/supabase/README.md) for details.

### USDA FoodData Central (optional – nutrition API for future server-side features)

- Request a [Data.gov API key](https://fdc.nal.usda.gov/api-key-signup.html) for the FDC REST API.
- Use **`USDA_FDC_API_KEY`** (server-only; never `NEXT_PUBLIC_*`). Bulk Foundation + SR Legacy CSVs ship under `AI-Recipe-App/data/`; load into Postgres with `npm run import:fdc` after applying migrations.

---

## Installation

1. **Clone the repository and go to the app:**
   ```bash
   git clone https://github.com/ChristVice/HomeRecipe.git
   cd HomeRecipe/next-app
   ```
   All commands below are run from the **`next-app`** folder.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment variables:**  
   Copy the example file and fill in your values:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` with the variables listed in the next section.

4. **Database:**  
   Apply all migrations with **`supabase db push`** (linked project) or Supabase MCP **`apply_migration`** / **`list_migrations`** — see [Database setup](#database-setup). Avoid pasting large migration SQL in the Dashboard for routine deploys.

5. **Run the dev server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

Create `.env.local` from `.env.local.example` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key (client-side) |
| `SUPABASE_SECRET_KEY` | For worker/imports | Supabase secret key (same role as `SUPABASE_SERVICE_ROLE_KEY` where supported; video worker, import scripts, storage setup; server-only) |
| `USDA_FDC_API_KEY` or `FDC_API_KEY` | Optional | USDA FoodData Central API key (server-only; search/detail fallback) |
| `NUTRITION_ESTIMATE_OPENAI_API_KEY` | Optional | Nutrition AI fallback; if unset, `OPENAI_REASONING_API_KEY` is used when present |
| `OPENAI_REASONING_API_KEY` | Optional | Video recipe extraction; also nutrition-estimate fallback when `NUTRITION_ESTIMATE_OPENAI_API_KEY` is unset |
| `OPENAI_AUDIO_TRANSCRIPTION_KEY` | Optional | Video worker Whisper transcription |
| `FDC_FOUNDATION_CSV_DIR` | Optional | Override path to Foundation CSV bundle for `npm run import:fdc` |
| `FDC_SR_LEGACY_CSV_DIR` | Optional | Override path to SR Legacy CSV bundle for `npm run import:fdc` |
| `SUPABASE_DB_PASSWORD` | Optional | Postgres password for Supabase CLI (`supabase link` / `db push`); not used by the Next.js app at runtime |

Optional video worker configuration (defaults are usually fine):

- `VIDEO_MAX_DURATION_SECONDS` – max video duration (default: 120)
- `VIDEO_MAX_FRAMES` – max frames to OCR (default: 300)
- `VIDEO_PROCESSING_TIMEOUT_MS` – per-job timeout in ms (default: 600000)
- `WORKER_ID` – worker identifier
- `WORKER_POLL_INTERVAL_MS` – poll interval (default: 5000)
- `WORKER_LOCK_TIMEOUT_MINUTES` – lock expiration (default: 10)

---

## Database setup

The app uses **Clerk** for auth and **Supabase** for the database. RLS policies use Clerk user IDs (`auth.jwt()->>'sub'`).

1. **Clerk + Supabase:**  
   Follow the Clerk–Supabase integration steps in [next-app/supabase/README.md](next-app/supabase/README.md).

2. **Apply migrations** from `next-app/supabase/migrations/` using **`supabase link`** and **`supabase db push`**, or Supabase MCP **`list_migrations`** / **`apply_migration`**, so the remote database matches the repo. Use the SQL Editor only for one-off debugging, not as the primary deploy path.

3. **Full chain:** The numbered files run in lexical order through **`030_drop_legacy_ingredients_table.sql`** (FDC nutrition **`026+`**, grocery **`027`**, comments **`028`**, **`fdc_candidates` `029`**, legacy **`ingredients` drop `030`**). Details and RLS notes: [next-app/supabase/README.md](next-app/supabase/README.md) and [next-app/README.md](next-app/README.md).

Migrations are idempotent where possible (IF EXISTS / IF NOT EXISTS). Do not skip or reorder.

---

## Running the application

- **Dev server only (from `next-app`):**
  ```bash
  npm run dev
  ```
  Next.js runs on **port 3000** using Webpack (Turbopack is disabled for Windows compatibility). Open http://localhost:3000.

- **Video worker** (optional; for video upload/OCR):  
  In a **second terminal**, from `next-app`:
  ```bash
  npm run worker:video
  ```
  Requires `SUPABASE_SECRET_KEY` in `.env.local`. See [next-app/WORKERS.md](next-app/WORKERS.md).

- **Both (Windows):**  
  From `next-app`, run `npm run dev:all` or double-click `dev-all.bat` to open two windows (dev server + video worker).

---

## Optional setup

### Recipe data (Open Recipes)

To populate the app with a large recipe dataset and enable search/suggestions:

1. Apply all migrations (including `007` then `030`, which drops the legacy `ingredients` table).
2. From `next-app`, with `SUPABASE_SECRET_KEY` in `.env.local`:
   ```bash
   npm run import:recipes    # Imports from Open Recipes (~230k recipes; downloads ~200MB)
   ```

### Video upload and OCR

1. Run migrations **010**, **011**, and **012**.
2. In Supabase Dashboard → **Storage**, create a **Private** bucket named `videos` (or run `npm run setup:storage` from `next-app` if you have the service role key).
3. Install FFmpeg (and optionally Tesseract) and ensure they are on your PATH.
4. Start the video worker in a separate terminal: `npm run worker:video`.

Full details: [next-app/VIDEO_UPLOAD_SETUP.md](next-app/VIDEO_UPLOAD_SETUP.md).

---

## Project structure and docs

- **`next-app/`** – Next.js app (all work here for running and editing the web app).
- **`next-app/README.md`** – App-specific dev and database summary.
- **`next-app/START.md`** – Quick “how to run” steps.
- **`next-app/WORKERS.md`** – Dev server vs. workers (separate processes).
- **`next-app/VIDEO_UPLOAD_SETUP.md`** – Video upload and OCR setup.
- **`next-app/supabase/README.md`** – Supabase and Clerk integration details.
- **`next-app/supabase/migrations/`** – All SQL migrations (apply via CLI or MCP per [next-app/supabase/README.md](next-app/supabase/README.md)).

---

## Build and deploy

```bash
cd HomeRecipe/next-app
npm run build
npm start
```

For **Vercel**: set the project **Root Directory** to `next-app`, add the same environment variables (Clerk, Supabase, and optional `USDA_FDC_API_KEY` when using FDC API features), then deploy.

---

## Troubleshooting

- **“Can’t resolve tailwindcss”**  
  Make sure you’re in the `next-app` folder when running `npm run dev`.

- **Clerk / auth issues**  
  Check that `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set and that redirect URLs in the Clerk Dashboard match your app (e.g. `http://localhost:3000/dashboard` for local dev).

- **Supabase / RLS errors**  
  Ensure Clerk is set as a provider in Supabase and that all migrations have been run in order. See [next-app/supabase/README.md](next-app/supabase/README.md).

- **Video worker: “Missing required environment variables”**  
  Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` to `.env.local` and restart the worker.

- **Video worker: “Failed to claim job” / “fetch failed”**  
  Check Supabase URL and service role key, and that the worker can reach the internet. Restart the worker after changing env.

- **Worker can’t find ffmpeg/tesseract**  
  Verify they’re on your PATH: `ffmpeg -version` and `tesseract --version`. Restart the terminal (or on Windows, sometimes the machine) after installing.

For more detail, see [next-app/START.md](next-app/START.md), [next-app/WORKERS.md](next-app/WORKERS.md), and [next-app/VIDEO_UPLOAD_SETUP.md](next-app/VIDEO_UPLOAD_SETUP.md).

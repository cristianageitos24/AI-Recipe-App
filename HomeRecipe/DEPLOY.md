# Deploying workers and Next.js (production)

This repo has **two containerized workers** under [docker-compose.yml](docker-compose.yml):

| Service | Dockerfile / context | Role |
|---------|----------------------|------|
| `recipe-url-import` | [services/recipe-url-import/Dockerfile](services/recipe-url-import/Dockerfile) | FastAPI: scrape **static recipe webpages** (JSON-LD / HTML). |
| `video-worker` | [next-app/Dockerfile.worker](next-app/Dockerfile.worker) | Node: **video** jobs (upload / TikTok URL) — ffmpeg, Tesseract, yt-dlp, OpenAI. Polls **Supabase**. |

The **Next.js app** ([next-app](next-app)) is usually hosted separately (e.g. **Vercel**). It does **not** need Docker on Vercel for a normal deploy.

---

## Critical rule: no `localhost` from the cloud

- **Vercel** (or any public Next.js host) **cannot** reach `http://localhost:8000` on your laptop.
- In production, deploy `recipe-url-import` to a host with a **public HTTPS URL** and set:

  **`RECIPE_URL_IMPORT_API_URL`** = that base URL **only** (no trailing slash), e.g. `https://recipe-import.yourcompany.com`

  Next.js proxies to `${RECIPE_URL_IMPORT_API_URL}/import-url` — see [next-app/app/api/recipes/import-url/route.ts](next-app/app/api/recipes/import-url/route.ts).

---

## Environment variables

### Next.js (Vercel / hosting dashboard)

- All existing app vars (Clerk, Supabase `NEXT_PUBLIC_*`, etc.) — see [next-app/.env.local.example](next-app/.env.local.example).
- **`RECIPE_URL_IMPORT_API_URL`** — **required** for webpage recipe URL import in production (HTTPS URL of the Python service).

### `recipe-url-import` (Python container)

- No secrets required for basic scraping; optional tuning can be added later via env if you extend the API.

### `video-worker` (Node container)

Mirror [next-app/.env.local.example](next-app/.env.local.example) for worker-related keys:

- **`NEXT_PUBLIC_SUPABASE_URL`**
- **`SUPABASE_SECRET_KEY`** (preferred for server/worker) **or** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (weaker; see security notes in example)
- **`OPENAI_AUDIO_TRANSCRIPTION_KEY`** — Whisper / transcription
- **`OPENAI_REASONING_API_KEY`** — recipe extraction from video

Optional: `VIDEO_*`, `WORKER_*`, `YT_DLP_PATH`, etc. — see [next-app/scripts/process-video-jobs.ts](next-app/scripts/process-video-jobs.ts).

**Never commit** real `.env.local` to Git. Use your host’s **secrets / environment variables** UI.

---

## Build contexts (for any Docker registry or Git-connected build)

From the **monorepo root** `HomeRecipe/`:

**Python recipe import**

- Context: `services/recipe-url-import`
- Dockerfile: default `Dockerfile` in that folder

**Video worker**

- Context: `next-app`
- Dockerfile: `Dockerfile.worker`

Example local build:

```bash
cd HomeRecipe
docker compose build
```

---

## Hosting the workers (Railway, Fly.io, Render, VPS, etc.)

General pattern (exact clicks differ per product):

1. **Create two services** from the **same GitHub repo** (or push images to a registry).
2. **Service A — recipe-url-import**
   - Root directory / context: `HomeRecipe/services/recipe-url-import` (or build args equivalent).
   - Expose **port 8000**; platform should provide **HTTPS** on a public URL.
   - Optional: use the image `HEALTHCHECK` hitting `GET /health`.
3. **Service B — video-worker**
   - Root directory / context: `HomeRecipe/next-app`
   - Dockerfile filename: **`Dockerfile.worker`**
   - **No public HTTP port required** — the worker only talks **outbound** to Supabase and OpenAI.
   - Set **all worker env vars** in the dashboard (not `env_file` — that is for local Compose only).
   - Use a plan that allows a **long-running process** (not serverless-only with zero long-running workers).

4. **Vercel (Next.js)**  
   - Set **`RECIPE_URL_IMPORT_API_URL`** to service A’s **HTTPS base URL**.

5. **Smoke tests**
   - `GET https://<your-python-host>/health` → `{"status":"ok"}`
   - From the app: submit a **recipe webpage URL** and confirm preview works.
   - Start a **video job** and confirm `video-worker` logs show processing.

---

## One VPS + Docker Compose

If you prefer a single Linux server:

- Copy the repo, install Docker Engine + Compose plugin.
- Create `next-app/.env.local` on the server (or use `export` + compose `environment:`) with production secrets.
- From `HomeRecipe/`: `docker compose up -d`
- Put **Caddy** or **nginx** in front of port **8000** for TLS and point your subdomain to the Python service.
- Still set **`RECIPE_URL_IMPORT_API_URL`** on Vercel to that **HTTPS** URL.

---

## Files reference

- [docker-compose.yml](docker-compose.yml) — local/dev: both workers + `env_file` for video-worker
- [next-app/WORKERS.md](next-app/WORKERS.md) — running dev server and Docker locally

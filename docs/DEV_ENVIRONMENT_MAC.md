# Mac development environment — tools, CLIs, MCPs

Use this file as your single reference while setting up Cursor on this Mac.  
**Do not paste API keys, tokens, or `.env` contents here** — only names, versions, and links to official docs.

---

## Machine

| Item | Your notes |
|------|------------|
| macOS version | |
| Chip (Apple Silicon / Intel) | Apple Silicon (arm64) |
| Primary terminal | iTerm2 |
| Shell | zsh |

---

## Core CLIs (installed / paths)

Fill versions with `command --version` when you want to refresh this table.

| Tool | Purpose | Install method | Typical path / verify command |
|------|---------|----------------|------------------------------|
| Git | Version control | Xcode CLT | `git --version` |
| Node.js | Next.js / npm | `~/.local/node` (or note if you switched) | `which node` → `node --version` |
| npm | JS packages | Comes with Node | `npm --version` |
| Homebrew | macOS packages | brew.sh | `brew --version` |
| Docker Desktop | Containers | Docker.app | `docker --version` |
| GitHub CLI | Auth, PRs, API | `brew install gh` | `gh auth status` |
| Supabase CLI | DB link, migrations | `brew install supabase/tap/supabase` | `supabase --version` |
| ffmpeg | Video processing | `brew install ffmpeg` | `ffmpeg -version` |
| Tesseract | OCR | `brew install tesseract` | `tesseract --version` |
| yt-dlp | TikTok / URL downloads | `brew install yt-dlp` | `yt-dlp --version` |

**PATH note:** If `node`/`npm` don’t show up in a fresh terminal, check `~/.zshenv` and `~/.zprofile` for Homebrew + Node.

---

## Official documentation (bookmark these)

Vendor docs are the source of truth for CLI flags, auth, and breaking changes. MCPs in Cursor still follow these APIs.

### Supabase

| Topic | Why it matters | Link |
|--------|----------------|------|
| Docs home | DB, Auth, Storage, Realtime | https://supabase.com/docs |
| CLI — install & local dev | `supabase init`, `supabase start` (uses Docker locally) | https://supabase.com/docs/guides/cli/getting-started |
| CLI reference | Exact commands and flags | https://supabase.com/docs/reference/cli |
| Row Level Security | Policies for multi-user data | https://supabase.com/docs/guides/auth/row-level-security |
| Third-party auth (e.g. Clerk) | External IdPs with Supabase | https://supabase.com/docs/guides/auth/third-party/overview |

### Clerk

| Topic | Why it matters | Link |
|--------|----------------|------|
| Docs home | Hub for all guides | https://clerk.com/docs |
| Next.js quickstart | Matches this repo’s stack | https://clerk.com/docs/nextjs/getting-started/quickstart |
| Clerk + Supabase | RLS with Clerk user IDs; native integration (JWT template deprecated) | https://clerk.com/docs/integrations/databases/supabase |
| Clerk Dashboard — Supabase setup | Activate integration, Clerk domain for Supabase provider | https://dashboard.clerk.com/setup/supabase |
| Doc sitemap (LLM-friendly index) | https://clerk.com/docs/llms.txt |

### Docker

| Topic | Why it matters | Link |
|--------|----------------|------|
| Docs home | Concepts, guides, install | https://docs.docker.com/ |
| Docker Desktop (macOS) | Desktop app behavior | https://docs.docker.com/desktop/ |
| Docker Compose | `docker compose`, Compose file format | https://docs.docker.com/compose/ |
| Dockerfile reference | Image builds (e.g. worker images) | https://docs.docker.com/reference/dockerfile/ |
| Docker CLI reference | `docker` subcommands | https://docs.docker.com/reference/cli/docker/ |

### MCP vs vendor docs

Cursor MCP servers are convenience wrappers. Behavior and permissions still follow **Supabase**, **Clerk**, and **Docker** APIs — use the tables above when something behaves unexpectedly.

---

## Cursor — MCP servers (optional but useful)

Add each MCP you enable in **Cursor Settings → MCP** (or project config).  
Paste **official doc URLs** in the tables above; keep tokens in Cursor’s secret fields or env, not in this file.

| MCP | What it helps with | Connected? (y/n) |
|-----|-------------------|------------------|
| Clerk | Auth, apps, dashboard tasks | |
| Supabase | DB, SQL, storage from chat | |
| Docker | Containers/images from tools | |

**Your project-specific notes:**

- Clerk Dashboard: (bookmark)
- Supabase Dashboard: (bookmark)

---

## This repo — services and ports

| Service | How you run it | Port / URL |
|---------|----------------|------------|
| Next.js app | `cd HomeRecipe/next-app && npm run dev` | http://localhost:3000 |
| Recipe URL import (Python) | Docker: `docker compose up recipe-url-import` from `HomeRecipe/`, or `npm run recipe-import-api` | http://localhost:8000 |
| Video worker | `npm run worker:video` or Docker `video-worker` | (polls Supabase; no browser UI) |

Compose file: `HomeRecipe/docker-compose.yml`  
Env template: `HomeRecipe/next-app/.env.local.example`

---

## Accounts and dashboards (no secrets in this file)

| Service | What you use it for | Dashboard URL |
|---------|---------------------|----------------|
| GitHub | Repo, PRs, Actions | https://github.com |
| Clerk | Sign-in, sessions | https://dashboard.clerk.com |
| Supabase | DB, Storage, SQL | https://supabase.com/dashboard |
| OpenAI | Whisper + recipe extraction (worker) | https://platform.openai.com |
| Edamam | Optional recipe search | https://developer.edamam.com |

---

## Daily shortcuts (copy when needed)

**Start app only**

```bash
cd ~/Documents/Projects/AI-Recipe-App/HomeRecipe/next-app
npm run dev
```

**Docker workers (from repo)**

```bash
cd ~/Documents/Projects/AI-Recipe-App/HomeRecipe
docker compose up -d
docker compose ps
```

**Local video worker (second terminal)**

```bash
cd ~/Documents/Projects/AI-Recipe-App/HomeRecipe/next-app
npm run worker:video
```

---

## Changelog (optional)

| Date | Change |
|------|--------|
| | Initial Mac setup doc |
| | Added official Supabase, Clerk, Docker doc links |

---

## How to use this with Cursor

- Point the assistant at this file: *“Read `docs/DEV_ENVIRONMENT_MAC.md` for my tools.”*
- When you add a new MCP or CLI, add one row to the right section and bump the changelog.

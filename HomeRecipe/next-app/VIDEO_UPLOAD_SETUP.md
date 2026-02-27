# Video Upload and OCR Processing Setup

This guide explains how to set up and run the video upload and OCR processing feature.

## Prerequisites

### System Dependencies

You need to install `ffmpeg`, `tesseract`, and **yt-dlp** on your system. yt-dlp is required for the **TikTok URL** flow (paste link → extract recipe); ffmpeg and tesseract are used for all video processing (OCR, audio extraction).

#### Windows (Chocolatey - Recommended)

```powershell
choco install ffmpeg tesseract -y
```

Install **yt-dlp** (for TikTok URL downloads) via pip (ensure Python Scripts is on PATH):

```powershell
pip install yt-dlp
```

#### Windows (Manual)

1. **Install ffmpeg:**
   - Download from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
   - Extract and add `bin` folder to PATH
   - Verify: `ffmpeg -version` and `ffprobe -version`

2. **Install Tesseract:**
   - Download installer from [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
   - Run installer, ensure "Add to PATH" is checked
   - Verify: `tesseract --version`

3. **Install yt-dlp (TikTok URL flow):**
   - **Option A:** `pip install yt-dlp` then add the Python Scripts folder to PATH (e.g. `%APPDATA%\Python\Python314\Scripts`).
   - **Option B:** Download `yt-dlp.exe` from [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) and add its folder to PATH.

4. **Verify PATH:**
   ```powershell
   $env:PATH -split ';' | Select-String -Pattern 'ffmpeg|tesseract|yt-dlp'
   ```
   Confirm: `yt-dlp --version`

#### macOS

```bash
brew install ffmpeg tesseract
```

#### Linux

```bash
sudo apt-get install ffmpeg tesseract-ocr
# or
sudo yum install ffmpeg tesseract
```

Install **yt-dlp**: `pip install yt-dlp` or use your package manager (e.g. `apt install yt-dlp` if available).

### npm Dependencies

Install npm packages:

```bash
npm install
```

This will install:
- `fluent-ffmpeg` - Node.js wrapper for ffmpeg
- `tesseract.js` - OCR library (fallback if CLI not available)
- `execa` - Used by the worker to run yt-dlp for TikTok downloads
- `openai` - Whisper API for audio transcription
- `@types/fluent-ffmpeg` - TypeScript types

OCR preprocessing (grayscale, contrast, sharpening) is done via ffmpeg—no sharp required.

## Database Setup

1. Run migrations in Supabase SQL Editor (in order):
   - `010_video_processing_jobs.sql` – jobs table
   - `011_storage_videos_policies.sql` – storage policies
   - `012_fix_claim_video_job_ambiguous_attempts.sql` – job claiming fix
   - `013_add_transcript_text.sql` – transcript column
   - `014_add_extracted_recipe.sql` – extracted_recipe JSONB column

2. Verify the table was created:
   ```sql
   SELECT * FROM video_processing_jobs LIMIT 1;
   ```

## Storage Setup

### Option 1: Manual Setup (Recommended)

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `videos`
4. Set to **Private** (not public)
5. Click "Create bucket"

6. Run Storage RLS policies (see `supabase/storage-setup.md`)

### Option 2: Automated Setup

```bash
npm run setup:storage
```

Requires `SUPABASE_SECRET_KEY` in `.env.local`.

## Environment Variables

Ensure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key  # Required for worker

# For audio transcription (speech-to-text)
OPENAI_AUDIO_TRANSCRIPTION_KEY=sk-...  # Worker-only, not exposed to browser

# For AI recipe extraction (OCR + transcript → structured recipe)
OPENAI_REASONING_API_KEY=sk-...  # Worker-only, not exposed to browser
```

Optional worker configuration:

```env
VIDEO_MAX_DURATION_SECONDS=120          # Max video duration in seconds (default: 120)
VIDEO_MAX_FRAMES=300                    # Max frames to OCR per video (default: 300). 1 fps, so 300 = 5 min.
VIDEO_PROCESSING_TIMEOUT_MS=600000      # Per-job timeout in ms (default: 600000 = 10 min). Increase for longer videos.
TRANSCRIPTION_TIMEOUT_MS=60000          # Whisper transcription timeout (default: 60000 = 60s)
WORKER_ID=my-worker                     # Worker identifier (default: hostname-pid)
WORKER_POLL_INTERVAL_MS=5000            # Polling interval (default: 5000)
WORKER_LOCK_TIMEOUT_MINUTES=10          # Lock expiration (default: 10)
```

## Running the Application

### 1. Start Next.js Development Server

```bash
npm run dev
```

### 2. Start Video Processing Worker

In a separate terminal:

```bash
npm run worker:video
```

The worker will:
- Poll for new video uploads
- Transcribe audio (Whisper) → stored in `transcript_text` (if `OPENAI_AUDIO_TRANSCRIPTION_KEY` set)
- Process videos with OCR → stored in `ocr_text`
- Extract structured recipe from OCR + transcript (if `OPENAI_REASONING_API_KEY` set) → stored in `extracted_recipe`
- Handle retries and errors automatically (transcription or reasoning failure does not fail the job)

### Production

For production, run the worker as a background service:

```bash
# Using PM2
pm2 start npm --name "video-worker" -- run worker:video

# Using systemd (Linux)
# Create a service file and enable it
```

## Usage

1. Navigate to `/dashboard/video-upload` (or use the Recipe Clip Studio panel on the dashboard).
2. **TikTok URL flow (recommended):** Paste a TikTok cooking video URL and click "Extract recipe from TikTok". The worker will download the video with yt-dlp, then run OCR and transcription. Ensure **yt-dlp** is installed and on PATH.
3. Wait for processing to complete.
4. View or edit the extracted recipe and save it to a cookbook.

## How It Works

1. **Upload:** User uploads video → stored in Supabase Storage → job created with status `uploaded`
2. **Processing:** Worker polls for jobs → claims job atomically → downloads video → extracts audio → transcribes (Whisper) → stores `transcript_text` → extracts frames (ffmpeg, OCR-optimized) → runs OCR → deduplicates text → stores `ocr_text` → marks job done
3. **Status:** UI polls job status every 2 seconds → displays results when complete

Transcription runs first; if it fails, OCR still runs and `transcript_text` stays NULL.

## Troubleshooting

### Worker can't find ffmpeg/tesseract

- Verify they're in PATH: `ffmpeg -version` and `tesseract --version`
- Restart terminal/IDE after installing
- On Windows, may need to restart computer for PATH changes

### Worker fails to download videos

- **TikTok URL jobs:** Ensure **yt-dlp** is installed and on PATH (`yt-dlp --version`). Restart the worker after installing so it picks up PATH. If the video is private or region-locked, the download may still fail.
- **Upload jobs:** Check `SUPABASE_SECRET_KEY` is set; verify Storage bucket exists and is named `videos`; check Storage RLS policies allow service role access.

### OCR not working

- Frames are preprocessed by ffmpeg (grayscale, contrast, sharpen)—no sharp needed
- Worker will fallback to tesseract.js if CLI not found
- Check worker logs for which provider is used
- Ensure video has clear, readable text

### Transcription not working

- Check `OPENAI_AUDIO_TRANSCRIPTION_KEY` is set in `.env.local` (worker-only, not in browser)
- If transcription fails, job still completes; `transcript_text` will be NULL

### Recipe extraction not working

- Check `OPENAI_REASONING_API_KEY` is set in `.env.local` (worker-only)
- If reasoning fails, job still completes; `extracted_recipe` will be NULL

### Jobs stuck in "processing"

- Check worker is running
- Check worker logs for errors
- Lock expires after 10 minutes, job can be reclaimed
- Max 3 attempts before job marked as error

## Architecture

- **API Routes:** `/api/video/upload` - File uploads; `/api/video/url` - TikTok URL job creation
- **Server Actions:** `app/actions/video-jobs.ts` - Fetch job status
- **Worker:** `scripts/process-video-jobs.ts` - Processes videos
- **Processing:** `lib/video-processing.ts` - Core OCR logic
- **Transcription:** `lib/transcription.ts` - Audio extraction + Whisper
- **Recipe reasoning:** `lib/recipe-reasoning.ts` - OCR + transcript → structured recipe (GPT-4.1 nano)
- **UI:** `app/dashboard/video-upload/page.tsx` - Upload interface

## Features

- ✅ Atomic job claiming (no double-processing)
- ✅ Audio transcription (OpenAI Whisper) → `transcript_text`
- ✅ AI recipe extraction (GPT-4.1 nano) → `extracted_recipe` (title, ingredients, steps)
- ✅ OCR with ffmpeg preprocessing (grayscale, contrast, sharpen)
- ✅ Retry logic with exponential backoff (max 3 attempts)
- ✅ Native Tesseract CLI with JS fallback
- ✅ Text cleanup and deduplication
- ✅ Duration and timeout guardrails
- ✅ Structured logging
- ✅ RLS security policies

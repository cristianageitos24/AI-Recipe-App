# Running the Dev Server and Workers Separately

The dev server (Next.js on port 3000) and background workers (e.g. video processing) run in **separate processes**. This avoids Turbopack errors and Windows resource issues that occurred when both were started together in one process.

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

The worker polls for video jobs and processes them (e.g. OCR). It uses the same env as the app: `.env.local` (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). See `.env.local.example` if needed.

---

## Run both (separate processes)

- **Windows**: Double‑click `dev-all.bat` in the `next-app` folder, or from a terminal in `next-app` run `npm run dev:all`. This opens two windows: one for the dev server, one for the video worker.
- **Other OS**: Open two terminals; in one run `npm run dev`, in the other `npm run worker:video`.

Neither approach runs the worker inside the same process as the Next.js dev server.

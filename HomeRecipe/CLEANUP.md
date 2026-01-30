# Cleanup after migration to Next.js

The app now runs entirely from **next-app** (Next.js + Supabase). The old Django backend and CRA frontend are no longer used.

## Optional: remove old folders

To fully remove the old code:

1. **Backend**: Close any process that might be using `backend/db.sqlite3` (e.g. Django runserver, IDE, file explorer). Then delete the `backend` folder.
2. **Frontend**: Delete the `frontend` folder.

If you prefer to keep them for reference, you can leave the folders in place or archive them outside the repo.

## Deploy

- Deploy from **next-app** (e.g. on Vercel set **Root Directory** to `next-app`).
- Configure environment variables as described in `next-app/README.md`.

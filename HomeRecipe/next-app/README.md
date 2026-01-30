# HomeRecipe – Next.js App

This is the main application: Next.js (App Router + TypeScript) with Supabase (Auth + Postgres) and Edamam for recipe search.

## Development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with Supabase and Edamam keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` from `.env.local.example` and set:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_EDAMAM_APP_ID` | Edamam Recipe Search Application ID |
| `NEXT_PUBLIC_EDAMAM_APP_KEY` | Edamam Recipe Search Application Key |

Optional (server-only):

- `SUPABASE_SERVICE_ROLE_KEY` – for admin/server-only Supabase operations

## Database

Run the SQL in `supabase/migrations/001_initial_schema.sql` in your Supabase project (SQL Editor). See `supabase/README.md` for schema and RLS details.

## Build

```bash
npm run build
npm start
```

## Deploy on Vercel

1. Set the project **Root Directory** to this folder (`next-app`) in Vercel.
2. Add the environment variables above in Vercel.
3. Deploy.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more options.

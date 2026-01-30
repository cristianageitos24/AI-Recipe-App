![HomeRecipeMockups](https://github.com/user-attachments/assets/05dc88a4-5d25-4509-88cb-bfbe2c0716ea)
![HomeRecipeTitle](https://github.com/user-attachments/assets/62a05a36-23c4-459e-8671-aa7d8402a923)

**HomeRecipe** is a fullstack web application that allows users to search for recipes, save their favorite dishes, and plan meals for the month.

## Stack

- **Next.js** (App Router, TypeScript) – UI and API in one codebase
- **Supabase** – PostgreSQL database and authentication
- **Edamam API** – Recipe search

## Features

- **User Authentication**: Sign up and log in via Supabase Auth.
- **Recipe Search**: Find recipes using the Edamam API.
- **Save and Organize**: Like recipes and save them to custom folders.
- **Meal Planning**: Add recipes to a personal calendar.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- [Edamam](https://www.edamam.com/) API credentials (Recipe Search API)

### Installation

1. Clone the repository and go to the app:

   ```bash
   git clone https://github.com/ChristVice/HomeRecipe.git
   cd HomeRecipe/next-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the database: run the SQL in `next-app/supabase/migrations/001_initial_schema.sql` in your Supabase project (SQL Editor). See `next-app/supabase/README.md` for details.

4. Copy environment variables and fill in your values:

   ```bash
   cp .env.local.example .env.local
   ```

   Required in `.env.local`:

   - `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon/public key
   - `NEXT_PUBLIC_EDAMAM_APP_ID` – Edamam Application ID
   - `NEXT_PUBLIC_EDAMAM_APP_KEY` – Edamam Application Key

5. Run the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Deploy (e.g. Vercel)

1. Import the repo in [Vercel](https://vercel.com) and set **Root Directory** to `next-app`.
2. Add the same environment variables (Supabase URL/anon key, Edamam App ID/Key).
3. Deploy. The Next.js app will be built and served from the `next-app` folder.

## Usage

- Sign up or log in.
- Use **Home** to search for recipes and save or like them.
- Use **Cookbooks** to manage folders and view saved recipes.
- Use **Meal Calendar** to plan meals by date.

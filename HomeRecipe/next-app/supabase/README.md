# Supabase setup

This app uses **Clerk** for authentication and **Supabase** for the database. Clerk session tokens are passed to Supabase for RLS (Row Level Security).

## Setup

1. **Enable Clerk as third-party auth in Supabase:**
   - In Clerk Dashboard → [Supabase integration](https://dashboard.clerk.com/setup/supabase) → Activate and copy your Clerk domain.
   - In Supabase Dashboard → **Authentication** → **Sign In / Up** → **Add provider** → **Clerk** → Paste the Clerk domain.

2. **Run the schema migrations in Supabase SQL Editor:**
   - Run `migrations/001_initial_schema.sql` (creates base tables).
   - Run `migrations/002_clerk_schema.sql` (adapts schema for Clerk user IDs).

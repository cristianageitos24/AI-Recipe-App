-- Migration: Switch from Supabase Auth to Clerk
-- WARNING: This migration drops and recreates user-related tables. All existing user data will be lost.
-- Run 001_initial_schema.sql first if setting up a fresh database.

-- 1. Drop Supabase Auth trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users manage own user_recipes" ON public.user_recipes;
DROP POLICY IF EXISTS "Users manage own folders" ON public.folders;
DROP POLICY IF EXISTS "Users manage folder_recipes of own folders" ON public.folder_recipes;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users manage own meal_dates" ON public.meal_dates;
DROP POLICY IF EXISTS "Users manage meal_date_recipes of own meal_dates" ON public.meal_date_recipes;

-- 3. Drop tables that reference profiles (order matters for FKs)
DROP TABLE IF EXISTS public.meal_date_recipes;
DROP TABLE IF EXISTS public.meal_dates;
DROP TABLE IF EXISTS public.folder_recipes;
DROP TABLE IF EXISTS public.folders;
DROP TABLE IF EXISTS public.favorites;
DROP TABLE IF EXISTS public.user_recipes;
DROP TABLE IF EXISTS public.profiles;

-- 4. Recreate profiles with Clerk user ID (TEXT)
CREATE TABLE public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  birthday DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Recreate user-recipes junction
CREATE TABLE public.user_recipes (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, recipe_id)
);

-- 6. Recreate folders
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL,
  UNIQUE(user_id, folder_name)
);

-- 7. Recreate folder-recipes junction
CREATE TABLE public.folder_recipes (
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, recipe_id)
);

-- 8. Recreate favorites
CREATE TABLE public.favorites (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, recipe_id)
);

-- 9. Recreate meal_dates and meal_date_recipes
CREATE TABLE public.meal_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.meal_date_recipes (
  meal_date_id UUID NOT NULL REFERENCES public.meal_dates(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_date_id)
);

-- 10. Recreate indexes
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_meal_dates_user_id ON public.meal_dates(user_id);
CREATE INDEX idx_meal_dates_date ON public.meal_dates(date);
CREATE INDEX idx_user_recipes_user_id ON public.user_recipes(user_id);

-- 11. RLS policies using Clerk JWT sub claim (auth.jwt()->>'sub')
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((auth.jwt()->>'sub') = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((auth.jwt()->>'sub') = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->>'sub') = id);

CREATE POLICY "Authenticated can read recipes" ON public.recipes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert recipes" ON public.recipes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users manage own user_recipes" ON public.user_recipes
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users manage own folders" ON public.folders
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users manage folder_recipes of own folders" ON public.folder_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.user_id = (auth.jwt()->>'sub'))
  );

CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users manage own meal_dates" ON public.meal_dates
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users manage meal_date_recipes of own meal_dates" ON public.meal_date_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meal_dates m WHERE m.id = meal_date_id AND m.user_id = (auth.jwt()->>'sub'))
  );

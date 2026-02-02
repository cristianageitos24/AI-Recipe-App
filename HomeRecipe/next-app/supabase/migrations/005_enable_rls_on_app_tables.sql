-- Enable RLS on all app tables and add Clerk-based policies (auth.jwt()->>'sub').
-- Idempotent: enables RLS, drops policies if exist, then creates policies.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_date_recipes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (e.g. from partial 002 apply)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users manage own folders" ON public.folders;
DROP POLICY IF EXISTS "Users manage folder_recipes of own folders" ON public.folder_recipes;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users manage own meal_dates" ON public.meal_dates;
DROP POLICY IF EXISTS "Users manage meal_date_recipes of own meal_dates" ON public.meal_date_recipes;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((auth.jwt()->>'sub') = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((auth.jwt()->>'sub') = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK ((auth.jwt()->>'sub') = id);

-- Recipes
CREATE POLICY "Authenticated can read recipes" ON public.recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert recipes" ON public.recipes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Folders
CREATE POLICY "Users manage own folders" ON public.folders
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);
CREATE POLICY "Users manage folder_recipes of own folders" ON public.folder_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.user_id = (auth.jwt()->>'sub'))
  );

-- Favorites
CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);

-- Meal dates
CREATE POLICY "Users manage own meal_dates" ON public.meal_dates
  FOR ALL USING ((auth.jwt()->>'sub') = user_id);
CREATE POLICY "Users manage meal_date_recipes of own meal_dates" ON public.meal_date_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meal_dates m WHERE m.id = meal_date_id AND m.user_id = (auth.jwt()->>'sub'))
  );

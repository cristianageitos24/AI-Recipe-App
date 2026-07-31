-- HomeRecipe Next.js schema (aligned with Supabase Auth)
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Profiles: extends auth.users (id = auth.uid())
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  birthday DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Recipes: shared by recipe_id (stable external / app recipe key)
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL UNIQUE,
  recipe_label TEXT NOT NULL,
  calories DECIMAL(10,2) NOT NULL,
  cuisine_type TEXT,
  meal_type TEXT,
  time_in_minutes INTEGER DEFAULT 0,
  ingredient_lines TEXT,
  website_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Folders
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_name TEXT NOT NULL,
  UNIQUE(user_id, folder_name)
);

-- Folder-recipes junction
CREATE TABLE public.folder_recipes (
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (folder_id, recipe_id)
);

-- Favorites: one row per (user, recipe)
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, recipe_id)
);

-- Meal dates (calendar events)
CREATE TABLE public.meal_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Meal date to recipe (one recipe per event in current app)
CREATE TABLE public.meal_date_recipes (
  meal_date_id UUID NOT NULL REFERENCES public.meal_dates(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_date_id)
);

-- Indexes for common lookups
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_meal_dates_user_id ON public.meal_dates(user_id);
CREATE INDEX idx_meal_dates_date ON public.meal_dates(date);

-- RLS: enable on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_date_recipes ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile; insert on signup (handled by trigger or app)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Recipes: authenticated users can read; anyone can insert (when saving from search)
CREATE POLICY "Authenticated can read recipes" ON public.recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert recipes" ON public.recipes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Folders: own data only
CREATE POLICY "Users manage own folders" ON public.folders
  FOR ALL USING (auth.uid() = user_id);

-- Folder-recipes: via folder ownership
CREATE POLICY "Users manage folder_recipes of own folders" ON public.folder_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.folders f WHERE f.id = folder_id AND f.user_id = auth.uid())
  );

-- Favorites: own data only
CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING (auth.uid() = user_id);

-- Meal dates: own data only
CREATE POLICY "Users manage own meal_dates" ON public.meal_dates
  FOR ALL USING (auth.uid() = user_id);

-- Meal_date_recipes: via meal_date ownership
CREATE POLICY "Users manage meal_date_recipes of own meal_dates" ON public.meal_date_recipes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meal_dates m WHERE m.id = meal_date_id AND m.user_id = auth.uid())
  );

-- Trigger: create profile on auth signup (optional; or create from Next.js)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

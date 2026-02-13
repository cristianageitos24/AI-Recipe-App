-- Add user_id to recipes for user-scoped manual/video recipes
-- user_id NULL = shared (Edamam); user_id set = private to that user
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);

-- Drop existing recipes policies
DROP POLICY IF EXISTS "Authenticated can read recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated can insert recipes" ON public.recipes;

-- New RLS: users see shared recipes (user_id IS NULL) or their own
CREATE POLICY "Users can read shared or own recipes" ON public.recipes
  FOR SELECT TO authenticated
  USING ((user_id IS NULL) OR (user_id = (auth.jwt()->>'sub')));

-- Insert: allow shared (NULL) or own user_id
CREATE POLICY "Users can insert recipes" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK ((user_id IS NULL) OR (user_id = (auth.jwt()->>'sub')));

-- Update: only own recipes
CREATE POLICY "Users can update own recipes" ON public.recipes
  FOR UPDATE TO authenticated
  USING (user_id = (auth.jwt()->>'sub'));

-- Delete: shared or own
CREATE POLICY "Users can delete shared or own recipes" ON public.recipes
  FOR DELETE TO authenticated
  USING ((user_id IS NULL) OR (user_id = (auth.jwt()->>'sub')));

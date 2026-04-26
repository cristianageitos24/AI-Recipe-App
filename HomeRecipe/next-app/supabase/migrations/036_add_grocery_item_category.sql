ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.grocery_items
  DROP CONSTRAINT IF EXISTS grocery_items_category_check;

ALTER TABLE public.grocery_items
  ADD CONSTRAINT grocery_items_category_check
  CHECK (
    category IS NULL
    OR category IN ('produce', 'dairy', 'pantry', 'condiments')
  );

CREATE INDEX IF NOT EXISTS idx_grocery_items_user_category
  ON public.grocery_items (user_id, category);

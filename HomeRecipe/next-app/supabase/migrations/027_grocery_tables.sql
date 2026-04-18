-- Grocery list and planned trips (referenced by app/actions/grocery-*.ts; previously missing from repo migrations).

CREATE TABLE IF NOT EXISTS public.grocery_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  planned_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, planned_date)
);

CREATE INDEX IF NOT EXISTS idx_grocery_trips_user_id ON public.grocery_trips (user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_trips_planned_date ON public.grocery_trips (planned_date);

CREATE TABLE IF NOT EXISTS public.grocery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  item_text TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grocery_items_user_id ON public.grocery_items (user_id);

ALTER TABLE public.grocery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own grocery_trips" ON public.grocery_trips;
CREATE POLICY "Users manage own grocery_trips" ON public.grocery_trips
  FOR ALL TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

DROP POLICY IF EXISTS "Users manage own grocery_items" ON public.grocery_items;
CREATE POLICY "Users manage own grocery_items" ON public.grocery_items
  FOR ALL TO authenticated
  USING (user_id = (auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

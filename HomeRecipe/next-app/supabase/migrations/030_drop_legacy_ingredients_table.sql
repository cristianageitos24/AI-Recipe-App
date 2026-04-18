-- Drop legacy public.ingredients (Open Recipes seed / autocomplete).
-- Autocomplete uses fdc_foods (server-side). No other tables reference this FK target.

DROP TABLE IF EXISTS public.ingredients CASCADE;

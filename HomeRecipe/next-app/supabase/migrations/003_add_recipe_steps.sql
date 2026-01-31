-- Add steps column for manual recipes (instruction lines, stored like ingredient_lines)
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS steps TEXT;

-- Make get_random_recipes skip soft-deleted rows and stay available for any callers.
-- App suggestions now prefer a list-column table read; this keeps the RPC safe if reused.

CREATE OR REPLACE FUNCTION public.get_random_recipes(p_limit int DEFAULT 12)
RETURNS SETOF public.recipes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.recipes
  WHERE deleted_at IS NULL
  ORDER BY random()
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 48));
$$;

COMMENT ON FUNCTION public.get_random_recipes(int) IS
  'Returns up to p_limit non-deleted random recipes. Prefer list-column selects in app code when possible.';

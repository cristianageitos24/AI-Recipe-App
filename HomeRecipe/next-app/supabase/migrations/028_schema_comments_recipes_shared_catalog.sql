-- Clarify shared-catalog semantics for `recipes` (supplements comments in older migration files; do not edit 001/015 history).
COMMENT ON TABLE public.recipes IS
  'Recipes keyed by recipe_id; user_id NULL means shared catalog rows, set means owned by that Clerk user.';
COMMENT ON COLUMN public.recipes.user_id IS
  'Clerk user id for user-created/imported rows; NULL for shared catalog rows visible to all authenticated users.';

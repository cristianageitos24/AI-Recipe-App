-- Drop Django and legacy api_* tables (run after backup).
-- Order: drop dependents first, then parent tables. IF EXISTS for idempotency.

-- API junction / M2M tables
DROP TABLE IF EXISTS public.api_customuser_user_permissions CASCADE;
DROP TABLE IF EXISTS public.api_customuser_groups CASCADE;
DROP TABLE IF EXISTS public.api_favorites_recipes CASCADE;
DROP TABLE IF EXISTS public.api_folders_recipes CASCADE;
DROP TABLE IF EXISTS public.api_mealdates_recipes CASCADE;
DROP TABLE IF EXISTS public.api_recipes_users CASCADE;

-- API main tables
DROP TABLE IF EXISTS public.api_favorites CASCADE;
DROP TABLE IF EXISTS public.api_folders CASCADE;
DROP TABLE IF EXISTS public.api_mealdates CASCADE;
DROP TABLE IF EXISTS public.api_recipes CASCADE;
DROP TABLE IF EXISTS public.api_customuser CASCADE;

-- Django tables (log and session reference content_type / user)
DROP TABLE IF EXISTS public.django_admin_log CASCADE;
DROP TABLE IF EXISTS public.django_session CASCADE;
DROP TABLE IF EXISTS public.authtoken_token CASCADE;

-- Django auth tables
DROP TABLE IF EXISTS public.auth_group_permissions CASCADE;
DROP TABLE IF EXISTS public.auth_group CASCADE;
DROP TABLE IF EXISTS public.auth_permission CASCADE;
DROP TABLE IF EXISTS public.django_content_type CASCADE;
DROP TABLE IF EXISTS public.django_migrations CASCADE;

-- Optional profile fields for Account settings (shared mobile + web).
-- phone_number was incorrectly typed as real; store as text (E.164 / freeform).
ALTER TABLE public.profiles
  ALTER COLUMN phone_number TYPE text
  USING CASE
    WHEN phone_number IS NULL THEN NULL
    ELSE trim(to_char(phone_number, 'FM999999999999999999'))
  END;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.profiles.phone_number IS 'Optional user phone (text); editable in app/web profile settings';
COMMENT ON COLUMN public.profiles.display_name IS 'Optional preferred display name; editable in app/web profile settings';
COMMENT ON COLUMN public.profiles.birthday IS 'Optional birthday; editable in app/web profile settings';

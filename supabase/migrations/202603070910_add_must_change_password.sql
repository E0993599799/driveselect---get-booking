BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

UPDATE public.profiles
SET must_change_password = FALSE
WHERE must_change_password IS NULL;

COMMIT;

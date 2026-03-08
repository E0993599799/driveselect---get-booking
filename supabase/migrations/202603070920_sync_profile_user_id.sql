BEGIN;

CREATE OR REPLACE FUNCTION public.sync_profile_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_user_id ON public.profiles;
CREATE TRIGGER profiles_sync_user_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_user_id();

UPDATE public.profiles
SET user_id = id
WHERE user_id IS NULL
  AND id IS NOT NULL;

COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS NULL OR NEW.role = '' OR NEW.role = 'member' THEN
    NEW.role := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_role ON public.profiles;
CREATE TRIGGER profiles_normalize_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_profile_role();

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL OR role = '' OR role = 'member';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'user'));

COMMIT;

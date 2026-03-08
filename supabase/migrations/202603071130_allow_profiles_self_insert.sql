BEGIN;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

COMMIT;

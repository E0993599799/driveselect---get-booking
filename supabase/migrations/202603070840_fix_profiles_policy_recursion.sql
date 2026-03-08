BEGIN;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO anon;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO service_role;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  USING (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS cars_select_auth ON public.cars;
DROP POLICY IF EXISTS cars_write_staff ON public.cars;
DROP POLICY IF EXISTS cars_update_staff ON public.cars;
DROP POLICY IF EXISTS cars_delete_admin ON public.cars;

CREATE POLICY cars_select_auth
  ON public.cars
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY cars_write_staff
  ON public.cars
  FOR INSERT
  WITH CHECK (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY cars_update_staff
  ON public.cars
  FOR UPDATE
  USING (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY cars_delete_admin
  ON public.cars
  FOR DELETE
  USING (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS drivers_select_auth ON public.drivers;
DROP POLICY IF EXISTS drivers_write_staff ON public.drivers;
DROP POLICY IF EXISTS drivers_update_staff ON public.drivers;
DROP POLICY IF EXISTS drivers_delete_admin ON public.drivers;

CREATE POLICY drivers_select_auth
  ON public.drivers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY drivers_write_staff
  ON public.drivers
  FOR INSERT
  WITH CHECK (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY drivers_update_staff
  ON public.drivers
  FOR UPDATE
  USING (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY drivers_delete_admin
  ON public.drivers
  FOR DELETE
  USING (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS bookings_select_own ON public.bookings;
DROP POLICY IF EXISTS bookings_select_staff ON public.bookings;
DROP POLICY IF EXISTS bookings_insert_auth ON public.bookings;
DROP POLICY IF EXISTS bookings_update_staff ON public.bookings;
DROP POLICY IF EXISTS bookings_delete_admin ON public.bookings;

CREATE POLICY bookings_select_own
  ON public.bookings
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

CREATE POLICY bookings_select_staff
  ON public.bookings
  FOR SELECT
  USING (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY bookings_insert_auth
  ON public.bookings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY bookings_update_staff
  ON public.bookings
  FOR UPDATE
  USING (public.current_profile_role() IN ('admin', 'staff'));

CREATE POLICY bookings_delete_admin
  ON public.bookings
  FOR DELETE
  USING (public.current_profile_role() = 'admin');

COMMIT;

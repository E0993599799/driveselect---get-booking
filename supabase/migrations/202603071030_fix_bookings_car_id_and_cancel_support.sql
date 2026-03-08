BEGIN;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS car_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_car_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_car_id_fkey
      FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.bookings b
SET car_id = c.id
FROM public.cars c
WHERE b.car_id IS NULL
  AND (
    (COALESCE(b.car_license, '') <> '' AND c.license_plate = b.car_license)
    OR c.name = b.car_name
  );

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

DROP POLICY IF EXISTS bookings_update_staff ON public.bookings;
DROP POLICY IF EXISTS bookings_cancel_own ON public.bookings;

CREATE POLICY bookings_update_staff
  ON public.bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
    )
  );

CREATE POLICY bookings_cancel_own
  ON public.bookings
  FOR UPDATE
  USING (user_id = auth.uid()::TEXT AND status IN ('pending', 'approved'))
  WITH CHECK (user_id = auth.uid()::TEXT AND status = 'cancelled');

NOTIFY pgrst, 'reload schema';

COMMIT;

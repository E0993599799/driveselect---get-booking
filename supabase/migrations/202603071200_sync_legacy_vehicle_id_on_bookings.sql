BEGIN;

DO $$
DECLARE
  vehicle_id_type TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS car_id BIGINT;

    SELECT data_type
    INTO vehicle_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'vehicle_id';

    -- Only cast legacy vehicle_id directly when it is already numeric-compatible.
    IF vehicle_id_type IN ('smallint', 'integer', 'bigint') THEN
      EXECUTE $sql$
        UPDATE public.bookings
        SET car_id = vehicle_id::BIGINT
        WHERE car_id IS NULL
          AND vehicle_id IS NOT NULL
      $sql$;
    END IF;

    -- Backfill using booking snapshot data for UUID-based legacy schemas.
    UPDATE public.bookings b
    SET car_id = c.id
    FROM public.cars c
    WHERE b.car_id IS NULL
      AND (
        (COALESCE(b.car_license, '') <> '' AND c.license_plate = b.car_license)
        OR c.name = b.car_name
      );

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bookings_car_id_fkey'
    ) THEN
      ALTER TABLE public.bookings
        ADD CONSTRAINT bookings_car_id_fkey
        FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;
    END IF;

    BEGIN
      ALTER TABLE public.bookings ALTER COLUMN vehicle_id DROP NOT NULL;
    EXCEPTION
      WHEN undefined_column THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

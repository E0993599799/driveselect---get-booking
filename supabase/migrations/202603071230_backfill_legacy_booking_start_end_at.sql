BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'start_at'
  ) THEN
    UPDATE public.bookings
    SET start_at = CONCAT(date_start, 'T', COALESCE(NULLIF(time_start, ''), '00:00'), ':00')::timestamp
    WHERE start_at IS NULL
      AND COALESCE(date_start, '') <> '';

    BEGIN
      ALTER TABLE public.bookings ALTER COLUMN start_at DROP NOT NULL;
    EXCEPTION
      WHEN undefined_column THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'end_at'
  ) THEN
    UPDATE public.bookings
    SET end_at = CONCAT(date_finish, 'T', COALESCE(NULLIF(time_finish, ''), '00:00'), ':00')::timestamp
    WHERE end_at IS NULL
      AND COALESCE(date_finish, '') <> '';

    BEGIN
      ALTER TABLE public.bookings ALTER COLUMN end_at DROP NOT NULL;
    EXCEPTION
      WHEN undefined_column THEN NULL;
      WHEN others THEN NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

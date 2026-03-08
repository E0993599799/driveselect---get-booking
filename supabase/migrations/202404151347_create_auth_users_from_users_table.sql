-- Create a new table to store the migration history
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Check if the migration has already been executed
DO $$
DECLARE
    migration_name VARCHAR(255) := 'create_auth_users_from_users_table';
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM migration_history
        WHERE migration_name = migration_name
    ) THEN
        -- Insert users into auth.users
        INSERT INTO auth.users (id, email, password, role)
        SELECT 
            id,
            email,
            -- Assuming password is stored in a column named 'password' in the users table
            password,
            'member' AS role
        FROM 
            public.users
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert migration history
        INSERT INTO migration_history (migration_name)
        VALUES (migration_name);
    END IF;
END $$;

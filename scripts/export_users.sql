-- Export legacy users to CSV for migration to Supabase Auth
-- Usage (run on your Postgres / legacy DB host):
-- psql "postgres://<user>:<pass>@<host>:<port>/<db>" -c "\copy (SELECT id, username, email, display_name, role, created_at, updated_at FROM users) TO 'users_export.csv' WITH CSV HEADER"

-- If you prefer a plain SQL file that writes to server-side filesystem (Postgres must have permissions):
-- COPY (SELECT id, username, email, display_name, role, created_at, updated_at FROM users) TO '/tmp/users_export.csv' CSV HEADER;

-- Columns exported:
-- id,username,email,display_name,role,created_at,updated_at
-- CqOL6YDuVTLNvaeW

postgresql://postgres:CqOL6YDuVTLNvaeW@db.kvyjgkhamwvelxveduvk.supabase.co:5432/postgres
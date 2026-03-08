Migration guide — DriveSelect
=============================

This folder contains helpers for migrating legacy `users` rows into Supabase Auth + `profiles`.

Workflow (safe, manual steps):

1. Export users from your legacy DB to CSV

   - Recommended: run the SQL in `scripts/export_users.sql` to produce a `users_export.csv` file.
   - Example (psql):

     ```powershell
     psql "postgres://<user>:<pass>@<host>:<port>/<db>" -c "\copy (SELECT id, username, email, display_name, role, created_at, updated_at FROM users) TO 'users_export.csv' WITH CSV HEADER"
     ```

2. Prepare Supabase service role credentials

   - Create a service role API key in the Supabase project: Settings → API → Service Key (service_role)
   - Export environment variables locally (do NOT commit keys):

     ```powershell
     $env:SUPABASE_URL = "https://<project>.supabase.co"
     $env:SUPABASE_SERVICE_ROLE_KEY = "<service_role_key>"
     ```

3. Install dependencies (if not already)

   ```powershell
   cd driveselect---get-booking
   npm install @supabase/supabase-js
   ```

4. Run the migration script

   ```powershell
   node scripts/migrate_users_to_supabase.js ./users_export.csv > migration_map.csv

   Optional: trigger password-reset emails for each migrated user (recommended)

   ```powershell
   # Using CLI flag
   node scripts/migrate_users_to_supabase.js ./users_export.csv --send-reset > migration_map.csv

   # Or set environment variable
   $env:SEND_PASSWORD_RESET = '1'
   node scripts/migrate_users_to_supabase.js ./users_export.csv > migration_map.csv
   ```
   ```

   Output: `migration_map.csv` containing `legacy_id,new_user_id,email,temp_password,notes` for each migrated user.

5. Next steps (manual)

   - Notify users to reset passwords (send password reset emails from Supabase console or trigger via API).
   - Verify a handful of migrated accounts by signing in.
   - Once satisfied, remove legacy auth endpoints and clean up `users` table only after verifying logins.

Security notes
--------------
- Never commit `SUPABASE_SERVICE_ROLE_KEY` to source control.
- Run the migration from a secure environment (CI runner or admin machine).
- Keep a backup of your legacy DB before running any destructive migrations.

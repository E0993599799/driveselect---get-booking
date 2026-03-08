# Todo — DriveSelect Vehicle Booking System
> Aligned with Plan.md v3.1 | Stack: Supabase + Cloudflare Pages | Updated: 2026-03-07

---

## 📊 Phase Progress Summary

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Fix PDF: ใบขออนุญาตใช้รถยนต์ | ✅ Complete (2 manual tests remain) |
| 2 | Supabase Auth Migration | 🔶 Partial (core frontend/schema done; live migration + cleanup pending) |
| 3 | Supabase Edge Functions | ⏳ Not started |
| 4 | Cloudflare Pages Deployment | 🔶 Partial (config ready; cloud/manual steps pending) |
| 5 | Supabase Storage for Images | ⏳ Not started |
| 6 | Full System Verification | ⏳ Not started |

---

## 🔎 Remaining Open Items (Reclassified)

### 1) Code pending

- [x] Create migration script to create Supabase Auth users from existing `users` rows
- [x] Seed/transform old `users` data into `profiles` safely
- [x] Remove `bcryptjs` and `jsonwebtoken` from `package.json` after final cutover
- [x] Remove legacy auth routes from `server.ts` (`/api/register`, `/api/login`, `/api/me`) after cutover
- [x] Mark/document `server.ts` as local-dev legacy only
- [x] Create Edge Functions:
  - [x] `supabase/functions/approve-booking/index.ts`
  - [x] `supabase/functions/reject-booking/index.ts`
  - [x] `supabase/functions/admin-set-role/index.ts`
- [x] Replace booking/admin status updates to `supabase.functions.invoke(...)`
- [x] Update car image flow to Supabase Storage (`photo_url` + upload flow)
- [x] Update driver image flow to Supabase Storage (`photo_url` + upload flow)
- [x] Update UI to use Storage URLs instead of base64 image data
- [x] Add 500KB client-side image size validation before upload
- [x] (Optional) Migrate old base64 images to Storage buckets
- [x] Future backlog features (mileage, notifications, reports, calendar, card selector, audit log, mobile app)

### 2) Manual environment action required

- [x] Run live SQL migration(s) in Supabase SQL editor:
  - [x] `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination TEXT;`
  - [x] `CREATE TABLE profiles ...` (if not yet applied in the live project)
- [x] Deploy `create-profile` Edge Function
- [x] Register `create-profile` as Supabase Auth webhook
- [x] Run/verify one-time data migration in live environment (existing users can still log in)
- [x] Archive old `users` table only after successful migration verification
- [x] Run PDF smoke test manually (Thai rendering + layout)
- [x] Install Wrangler CLI locally (if not installed)
- [x] Cloudflare Pages setup:
  - [x] Create account/project (`driveselect`)
  - [x] Connect Git integration or run manual deploy
  - [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Pages env
- [x] Cloudflare custom domain + DNS + SSL activation/verification
- [x] Supabase Storage setup in dashboard:
  - [x] Create buckets (`vehicle-images`, `driver-photos`)
  - [x] Configure bucket policies (upload/read)
- [x] Full system verification checklist (Phase 6)
- [x] Production verification: `driveselect.pages.dev` and/or custom domain availability + SSL

---

## ✅ Completed (do not change)

### Supabase Backend Setup
- [x] Initialize Supabase client in `server.ts`
- [x] Configure Supabase tables (`users`, `cars`, `drivers`, `bookings`)
- [x] Run application locally after setting up Supabase
- [x] Verify initial data seeding into Supabase tables

### API — User Authentication
- [x] Verify `/api/register` creates new users in Supabase
- [x] Verify `/api/login` authenticates users and returns a valid JWT
- [x] Verify `/api/me` retrieves user information using the JWT

### API — Car Management
- [x] Verify `/api/cars` (GET) retrieves all cars from Supabase
- [x] Verify `/api/cars` (POST) adds a car to Supabase
- [x] Verify `/api/cars/:id` (PATCH) updates an existing car in Supabase
- [x] Verify `/api/cars/:id` (DELETE) removes a car from Supabase

### API — Driver Management
- [x] Verify `/api/drivers` (GET) retrieves all drivers from Supabase
- [x] Verify `/api/drivers` (POST) adds a new driver to Supabase
- [x] Verify `/api/drivers/:id` (PATCH) updates an existing driver in Supabase
- [x] Verify `/api/drivers/:id` (DELETE) removes a driver from Supabase

### API — Booking Management
- [x] Verify `/api/bookings` (GET) retrieves all bookings with joined car and driver data
- [x] Verify `/api/bookings` (POST) creates a new booking in Supabase
- [x] Verify `/api/bookings/:id` (PATCH) updates booking status, reject reason, and driver
- [x] Verify `/api/bookings/:id` (DELETE) removes a booking from Supabase

### Frontend Integration
- [x] Update frontend components to interact with refactored API endpoints
- [x] Handle API response structure changes from migration

---

## Phase 1 — Fix PDF: ใบขออนุญาตใช้รถยนต์ ✅ COMPLETE

- [x] Add Sarabun Thai font to `index.html` (preconnect + stylesheet link)
- [x] Set `lang="th"` and title to "DriveSelect - ระบบจองรถยนต์" in `index.html`
- [x] Create `src/components/BookingPdfTemplate.tsx` — hidden A4 div (`794px × 1123px`)
  - [x] Header: กรมสวัสดิการและคุ้มครองแรงงาน + ใบขออนุญาตใช้รถยนต์
  - [x] Date row: วันที่ / เดือน / พ.ศ. in Thai Buddhist era format (Gregorian + 543)
  - [x] Requester section: ข้าพเจ้า, ตำแหน่ง, กลุ่มงาน/งาน
  - [x] Trip section: ไปที่ไหน (`destination`), เพื่อ (`objective`), มีคนนั่ง
  - [x] Date/time row: วันที่เริ่ม เวลา — ถึงวันที่ เวลา
  - [x] Contact row: เบอร์ติดต่อ
  - [x] Requester signature block (ลงชื่อ / ผู้ขออนุญาต)
  - [x] Divider line
  - [x] Vehicle type checkboxes: □ รถเก๋ง / □ รถกระบะ / □ รถตู้ + ทะเบียน (auto-checked by car type)
  - [x] Driver assignment: โดยมอบหมายให้ ___ เป็นพนักงานขับรถยนต์
  - [x] Authorizer signature block + title นักจัดการงานทั่วไปปฏิบัติการ
  - [x] Mileage section: เลขไมล์ก่อน / หลัง / รวม + ออกเวลา / ถึงเวลา
  - [x] Driver signature at bottom
  - [x] `font-family: 'Sarabun', sans-serif` on root div, all inline styles (no Tailwind)
- [x] Rewrite `exportPDF()` in `src/App.tsx`:
  - [x] Mount `BookingPdfTemplate` via `pdfBooking` state (hidden fixed div off-screen)
  - [x] `await html2canvas(pdfTemplateRef.current, { scale: 2, useCORS: true })`
  - [x] `new jsPDF('p', 'mm', 'a4')` → `addImage(canvas, 'PNG', 0, 0, 210, 297)`
  - [x] `doc.save('ใบขออนุญาตใช้รถยนต์_${booking.id}.pdf')`
  - [x] Unmount template div after export (set `pdfBooking` back to null)
- [x] Add `destination` field to `Booking` interface in `src/App.tsx`
- [x] Add `destination: ""` to `formData` state and reset in `handleBooking()`
- [x] Add `destination` input to booking form ("ขออนุญาตใช้รถยนต์ (ไปที่ไหน)")
- [x] Rename `objective` label → "เพื่อ (วัตถุประสงค์)"
- [x] Add "My Bookings" section to user view — PDF download button for any status
- [x] Update `supabase_schema.sql` with `destination TEXT` column + migration comment
- [x] Fix duplicate `const PORT = 3000` bug in `server.ts`
- [x] Fix `package.json` scripts: `dev` = Vite, `dev:server` = Express, add `deploy` script
- [x] `tsc --noEmit` → 0 errors
- [x] `vite build` → exit 0, `dist/` created (2321 modules, no secrets in output)

### Phase 1 — Manual Steps (USER ACTION REQUIRED)
- [x] **Run SQL migration** on live Supabase project SQL editor:
  ```sql
  ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination TEXT;
  ```
- [x] **Smoke test:** Make a booking → click PDF download → verify Thai text renders correctly

---

## Phase 2 — Supabase Auth Migration 🔶 PARTIAL

**Goal:** Replace `server.ts` custom JWT + bcrypt with Supabase Auth. Eliminates Express server from production.

**Current state (confirmed by code review):**
- `src/App.tsx` now uses `supabase.auth.*` for login/register/logout/session
- Frontend CRUD now uses `supabase.from(...)` directly
- `src/lib/supabase.ts` exists and reads `VITE_SUPABASE_*`
- `supabase/functions/create-profile/index.ts` exists
- `@supabase/supabase-js` is present in `package.json` dependencies

### 2.1 Database — profiles table
- [x] Add `profiles` table to `supabase_schema.sql`:
  ```sql
  CREATE TABLE profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username     TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    position     TEXT,
    organization TEXT,
    internal_tel TEXT,
    mobile_tel   TEXT,
    role         TEXT DEFAULT 'user' CHECK (role IN ('admin','staff','user')),
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- [x] Run the `CREATE TABLE profiles` migration on live Supabase

### 2.2 RLS Policies
- [x] Enable RLS on all tables:
  ```sql
  ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE cars      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE drivers   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;
  ```
- [x] Policy: authenticated user can read/update own profile
- [x] Policy: admin can read all profiles
- [x] Policy: any authenticated user can read cars
- [x] Policy: staff/admin can insert/update/delete cars
- [x] Policy: authenticated user can read own bookings (filter by user_id)
- [x] Policy: staff/admin can read all bookings
- [x] Policy: any authenticated user can insert booking

### 2.3 Supabase client singleton
- [x] Install `@supabase/supabase-js`: `npm install @supabase/supabase-js`
- [x] Create `src/lib/supabase.ts`:
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  ```
- [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` (VITE_ prefix required for Vite)

### 2.4 Edge Function — create-profile (Auth trigger)
- [x] Create `supabase/functions/create-profile/index.ts`
  - Triggered when new Supabase Auth user is created
  - Inserts row into `profiles` with name, position, org, tel from metadata
- [x] Deploy: `npx supabase functions deploy create-profile`
- [x] Register as Auth webhook in Supabase dashboard (Auth → Hooks)

### 2.5 Frontend auth replacement
- [x] Replace `handleLogin` → `supabase.auth.signInWithPassword({ email, password })`
- [x] Replace `handleRegister` → `supabase.auth.signUp({ email, password, options: { data: {...} } })`
- [x] Replace `handleLogout` → `supabase.auth.signOut()`
- [x] Replace `localStorage.getItem('token')` → `supabase.auth.getSession()`
- [x] Replace `fetch('/api/me')` → `supabase.from('profiles').select().eq('id', user.id)`
- [x] Add `supabase.auth.onAuthStateChange()` listener
- [x] Update registration form: switch from `username` to `email` as login credential

### 2.6 Frontend CRUD replacement
- [x] Replace `fetch('/api/cars')` → `supabase.from('cars').select('*')`
- [x] Replace `fetch('/api/cars', POST)` → `supabase.from('cars').insert()`
- [x] Replace `fetch('/api/cars/:id', PATCH)` → `supabase.from('cars').update().eq('id')`
- [x] Replace `fetch('/api/cars/:id', DELETE)` → `supabase.from('cars').delete().eq('id')`
- [x] Replace all driver mutations similarly (`/api/drivers`)
- [x] Replace `fetch('/api/bookings')` → Supabase query via `supabase.from('bookings').select(...)`
- [x] Replace `fetch('/api/bookings', POST)` → `supabase.from('bookings').insert()`

### 2.7 Data migration (one-time)
- [x] Script to create Supabase Auth users from existing `users` table rows
- [x] Seed `profiles` table from `users` table data
- [x] Verify all existing users can log in after migration
- [x] Archive old `users` table after confirming success

### 2.8 Cleanup
- [x] Remove `bcryptjs` and `jsonwebtoken` from `package.json` dependencies
- [x] Remove auth routes from `server.ts` (POST /api/register, /api/login, GET /api/me)
- [x] Mark `server.ts` as local dev only (not used in production)

---

## Phase 3 — Supabase Edge Functions (Booking Operations) ⏳ NOT STARTED

**Goal:** Replace Express booking status routes with Deno Edge Functions.
**Current state:** `supabase/` exists; only `create-profile` function is present. Booking/admin Edge Functions are still pending.

- [x] Create `supabase/functions/approve-booking/index.ts`
  - Verify caller role is `staff` or `admin` (via JWT claims)
  - `UPDATE bookings SET status='approved', driver_id=<assigned>`
- [x] Create `supabase/functions/reject-booking/index.ts`
  - Verify caller role is `staff` or `admin`
  - `UPDATE bookings SET status='rejected', reject_reason=<reason>`
- [x] Create `supabase/functions/admin-set-role/index.ts`
  - Verify caller role is `admin`
  - `UPDATE profiles SET role=<new_role>`
- [x] Deploy all functions:
  ```bash
  npx supabase functions deploy approve-booking
  npx supabase functions deploy reject-booking
  npx supabase functions deploy admin-set-role
  ```
- [x] Replace `fetch('/api/bookings/:id', PATCH approve)` → `supabase.functions.invoke('approve-booking')`
- [x] Replace `fetch('/api/bookings/:id', PATCH reject)` → `supabase.functions.invoke('reject-booking')`
- [x] Replace admin role change → `supabase.functions.invoke('admin-set-role')`
- [x] Test: staff JWT → approve succeeds; user JWT → 403 rejected

---

## Phase 4 — Cloudflare Pages Deployment 🔶 PARTIAL

**Goal:** React app live at production URL via Cloudflare Pages. No server needed.

### 4.1 Vite config cleanup
- [x] Remove `process.env.GEMINI_API_KEY` define from `vite.config.ts` (not used in production)
- [x] Remove `DISABLE_HMR` / AI Studio comment from `vite.config.ts`
- [x] Add dev proxy for legacy local dev: `server.proxy: { '/api': 'http://localhost:3000' }`
- [x] Confirm `build.outDir: 'dist'` (currently default, no explicit config needed)

### 4.2 Package scripts
- [x] `"dev": "vite"` — Vite dev server
- [x] `"dev:server": "tsx server.ts"` — Express backend (local only)
- [x] `"build": "vite build"`
- [x] `"preview": "vite preview"`
- [x] `"deploy": "npm run build && npx wrangler pages deploy dist --project-name driveselect"`
- [x] `"lint": "tsc --noEmit"`
- [x] Install Wrangler CLI: `npm install -D wrangler`

### 4.3 Cloudflare Pages setup (manual — user action)
- [x] Create Cloudflare account (if not existing)
- [x] Create new Pages project named `driveselect`
- [x] **Option A — Git integration (recommended):**
  - [x] Connect GitHub repo to Cloudflare Pages
  - [x] Build command: `npm run build` | Output directory: `dist`
- [x] **Option B — Manual deploy:**
  - [x] `npm install -D wrangler` then `npm run deploy`

### 4.4 Environment variables in Cloudflare Pages (manual — user action)
- [x] CF Pages → Settings → Environment variables → add for Production + Preview:
  - [x] `VITE_SUPABASE_URL` = `https://kvyjgkhamwvelxveduvk.supabase.co`
  - [x] `VITE_SUPABASE_ANON_KEY` = your anon key

### 4.5 `.env` local file
- [x] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` (VITE_ prefix for frontend)
  - Note: existing `SUPABASE_URL` / `SUPABASE_ANON_KEY` are for `server.ts` (no VITE_ prefix)
- [x] `.env` file exists (confirmed)
- [x] `.env` is in `.gitignore` (confirm — check `.gitignore`)

### 4.6 Custom domain via Cloudflare DNS (manual — user action)
- [x] CF Pages → Custom domains → Add domain
- [x] Cloudflare auto-adds CNAME in DNS dashboard
- [x] Verify SSL certificate active
- [x] Test custom domain loads the app

### 4.7 Build verification
- [x] `npm run build` — 0 TypeScript errors, `dist/` created
- [x] `dist/` contains no service role keys (`grep -r "service_role" dist/` → empty)
- [x] App loads at `https://driveselect.pages.dev` (requires deploy)
- [x] Custom domain SSL valid

---

## Phase 5 — Supabase Storage for Images ⏳ NOT STARTED

**Goal:** Replace base64 blobs in DB with Supabase Storage URLs.

- [x] Create storage bucket `vehicle-images` (public read) in Supabase dashboard
- [x] Create storage bucket `driver-photos` (public read) in Supabase dashboard
- [x] Set bucket policies: authenticated users can upload, public can read
- [x] Update car add/edit form:
  - [x] Upload image to `vehicle-images` bucket on file select
  - [x] Store returned public URL in `cars.photo_url`
  - [x] Add `photo_url TEXT` column to `cars` table (`ALTER TABLE cars ADD COLUMN IF NOT EXISTS photo_url TEXT;`)
- [x] Update driver add/edit form:
  - [x] Upload image to `driver-photos` bucket on file select
  - [x] Store returned public URL in `drivers.photo_url`
  - [x] Add `photo_url TEXT` column to `drivers` table
- [x] Update UI to display `photo_url` instead of base64 `image` column
- [x] Add 500KB client-side file size check before upload
- [x] (Optional) Migrate existing base64 images to Storage buckets

---

## Phase 6 — Full System Verification ⏳ NOT STARTED

- [x] Register new user → profile row created in `profiles` table
- [x] Login → Supabase session active, user profile loaded
- [x] Session persists on page refresh
- [x] Logout clears session
- [x] View car list → renders with photos from Storage
- [x] Create booking with `destination` and `objective` → saved to Supabase
- [x] Staff approves booking + assigns driver → status = `approved`
- [x] Staff rejects booking with reason → status = `rejected`
- [x] Download PDF (user, any status) → Thai text readable, requester info filled
- [x] Download PDF (staff, approved) → vehicle type checkbox marked, driver name populated
- [x] User cannot see other users' bookings (RLS enforced)
- [x] User cannot call `approve-booking` Edge Function → 403
- [x] Staff cannot call `admin-set-role` Edge Function → 403
- [x] No service role key visible in browser DevTools → Network tab
- [x] Production URL (`driveselect.pages.dev` or custom domain) loads correctly
- [x] Custom domain SSL shows valid certificate

---

## Future Backlog

- [x] Mileage tracking — driver fills in เลขไมล์ก่อน/หลัง fields after trip
- [x] Register and Login by Google
- [x] Email notifications — booking status change via Resend or Supabase Email
- [x] Web push notifications — new booking alert for staff (web-push, no Firebase)
- [x] Monthly booking report PDF — admin export with date range filter
- [x] Booking calendar view — visual timeline per vehicle
- [x] Vehicle photo card selector — card grid replacing text dropdown
- [x] Audit log table — track all admin actions (who changed what, when)
- [x] React Native mobile companion app (reuses same Supabase backend)

---

## Phase 7 — Admin Module + User Settings ⏳ NOT STARTED

### 7.1 Admin module — user management
- [ ] Add `users` tab to admin area UI
- [ ] Show all users from `profiles`
- [ ] Add search/filter by name, email, role, active status
- [ ] Add create-user modal/form for admin
- [ ] Add edit-user modal/form for admin
- [ ] Add deactivate/reactivate action
- [ ] Add delete-user action with confirmation
- [ ] Prevent deleting the last active admin
- [ ] Prevent accidental self-delete without explicit confirmation

### 7.2 Admin module — role/admin management
- [ ] Allow admin to promote/demote roles: `user` / `staff` / `admin`
- [ ] Allow admin to manage another admin account
- [ ] Restrict role changes to admin only
- [ ] Add audit-friendly confirmation text for admin role changes

### 7.3 Admin module — car management completion
- [ ] Confirm all car add/edit/remove actions are available from admin module
- [ ] Align car management permissions so admin can fully manage cars
- [ ] Ensure another admin can also add/edit/remove cars

### 7.4 User settings module
- [ ] Add settings screen/panel for authenticated user
- [ ] Add self-profile edit form
- [ ] Allow user to update:
  - [ ] name
  - [ ] position
  - [ ] organization
  - [ ] internal telephone
  - [ ] mobile telephone
  - [ ] display name (if retained in live schema)
- [ ] Add self password-change form using `supabase.auth.updateUser`
- [ ] Show account role and account status in settings screen

### 7.5 Database / RLS / Edge Functions
- [ ] Add migration for any missing `profiles` support columns needed by settings/admin UI
- [ ] Add/verify `updated_at` support on `profiles`
- [ ] Create `admin-create-user` Edge Function
- [ ] Create `admin-update-user` Edge Function
- [ ] Create `admin-delete-user` Edge Function
- [ ] Reuse or extend `admin-set-role` for role changes
- [ ] Verify RLS still allows users to update only their own settings
- [ ] Verify non-admins cannot manage other users

### 7.6 Verification
- [ ] Admin creates new user successfully
- [ ] Admin edits existing user successfully
- [ ] Admin deactivates/reactivates user successfully
- [ ] Admin promotes another user to admin successfully
- [ ] Another admin can manage cars and users
- [ ] User updates own profile successfully
- [ ] User changes own password successfully
- [ ] Non-admin cannot access admin module or admin Edge Functions

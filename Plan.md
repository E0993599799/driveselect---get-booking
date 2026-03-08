# DriveSelect — Vehicle Booking System
## Complete Production Plan (Supabase + Cloudflare)
> Version: 3.1 | Updated: 2026-03-07

---

## 0. Stack Decision

### Recommended Stack
| Layer | Technology | Reason |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS | Already built — keep as-is, no rewrite needed |
| Auth | Supabase Auth (email/password) | Replaces custom JWT + bcrypt — zero server code |
| Database | Supabase PostgreSQL + RLS | Already in use |
| API | Supabase Edge Functions (Deno) | Replaces Express — no cold start, zero infrastructure |
| File Storage | Supabase Storage | Replaces base64 images stored in DB |
| Hosting | Cloudflare Pages | Free CDN, auto-deploy from Git, SPA support |
| Domain | Cloudflare DNS | CNAME pointing to Cloudflare Pages URL |
| PDF Export | html2canvas + jsPDF (client-side) | Thai font rendering via browser, no server needed |

### Note on "React Native"
React Native is a **mobile** framework (iOS/Android). This system needs PDF export via
`html2canvas` which requires a browser DOM — incompatible with React Native.

**Decision:** Keep React (web) now. A React Native companion app for mobile can be
built in Phase 3 using the same Supabase backend.

### Why NOT a separate Express/Node backend
With Supabase Auth + RLS + Edge Functions, no separate backend server is needed:
- Auth → Supabase handles login, tokens, refresh, sessions
- Simple CRUD → direct Supabase JS client calls from frontend
- Complex ops → Supabase Edge Functions (Deno, no Node.js needed)
- `server.ts` is **deprecated** for production; kept only for legacy local dev

---

## 1. Current State Assessment

### What exists and works
| Layer | Current | Status |
|---|---|---|
| Frontend | React 19 + Vite 6 + TypeScript + Tailwind CSS | ✅ Working |
| Backend | Express.js in `server.ts` (local dev only) | ✅ Local only |
| Database | Supabase PostgreSQL | ✅ Connected |
| Auth | Custom JWT + bcryptjs in server.ts | ✅ Working (to be replaced) |
| PDF Export | jsPDF text-only | ⚠️ Thai characters broken |
| Hosting | Localhost only | ❌ Not deployed |
| Images | Base64 stored in DB columns | ⚠️ Large payloads |

### Current Tables (Supabase)
```
users      → id, username, password, name, position, organization,
             internal_tel, mobile_tel, role
cars       → id, name, type, image (base64), license_plate, seats, available
drivers    → id, name, tel, image (base64)
bookings   → id, car_id, user_id, user_name, user_position, user_organization,
             tel, objective, passenger, note, date_start, date_finish,
             time_start, time_finish, status, reject_reason, driver_id
```

### Critical Bugs / Gaps
1. **PDF Thai font** — jsPDF default font cannot render Thai; text becomes squares
2. **No production deployment** — runs only via `tsx server.ts` locally
3. **Duplicate `PORT` declaration** in server.ts lines 24–25 (syntax error)
4. **No RLS** — all tables accessible with anon key (security risk)
5. **No `destination` field in bookings** — `objective` doubles as destination,
   does not match official form which has separate fields for "ไปที่ไหน" and "เพื่อ"
6. **Images as base64 in DB** — bloats database rows

---

## 2. Target Architecture

```
┌───────────────────────────────────────────────────────┐
│  User Browser                                         │
│  https://driveselect.yourdomain.com                   │
└─────────────────────┬─────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼─────────────────────────────────┐
│  Cloudflare (DNS + CDN)                               │
│  ├── DNS: CNAME → pages.dev URL                       │
│  └── Cloudflare Pages: serves dist/ (Vite build)      │
└─────────────────────┬─────────────────────────────────┘
                      │ Supabase JS Client (from browser)
┌─────────────────────▼─────────────────────────────────┐
│  Supabase Project                                     │
│  ├── Auth — login / register / session / JWT          │
│  ├── PostgreSQL + RLS — cars, drivers, bookings,      │
│  │                      profiles                      │
│  ├── Edge Functions (Deno) — admin ops, approvals     │
│  └── Storage — vehicle images, driver photos          │
└───────────────────────────────────────────────────────┘
```

### Data Flow — Simple Operations (direct from browser)
```
Frontend → supabase.from('cars').select()         → PostgreSQL (via RLS)
Frontend → supabase.from('bookings').insert()     → PostgreSQL (via RLS)
Frontend → supabase.auth.signInWithPassword()     → Supabase Auth
Frontend → supabase.storage.from('images').upload → Supabase Storage
```

### Data Flow — Protected Operations (via Edge Functions)
```
Frontend → invoke('approve_booking', { booking_id })
         → Edge Function (service_role) → UPDATE bookings SET status='approved'

Frontend → invoke('admin_set_user_role', { user_id, role })
         → Edge Function (service_role) → UPDATE profiles SET role=...
```

---

## 3. Database Schema (Target)

### 3.1 Migrate from custom users table to Supabase Auth

**Old:** `users` table with `username`, `password` (bcrypt), custom JWT

**New:** Supabase Auth manages credentials. A `profiles` table stores app-specific fields:

```sql
-- profiles table (linked to Supabase Auth user)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  position    TEXT,
  organization TEXT,
  internal_tel TEXT,
  mobile_tel  TEXT,
  role        TEXT DEFAULT 'user' CHECK (role IN ('admin', 'staff', 'user')),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup (via trigger or Edge Function)
```

### 3.2 Cars table (add `photo_url`)
```sql
ALTER TABLE cars ADD COLUMN IF NOT EXISTS photo_url TEXT;
-- photo_url = Supabase Storage URL (replaces base64 `image` column)
-- Keep `image` column temporarily for migration, remove in Phase 2
```

### 3.3 Drivers table (add `photo_url`)
```sql
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

### 3.4 Bookings table (add `destination` field)
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS destination TEXT;
-- destination = "ขออนุญาตใช้รถยนต์ (ไปที่ไหน)"
-- existing `objective` = "เพื่อ (วัตถุประสงค์)"
-- existing `note` = extra notes
```

### 3.5 RLS Policies
```sql
-- Enable RLS on all tables
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;

-- profiles: user can read/update own profile
CREATE POLICY "Own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- profiles: admin can read all
CREATE POLICY "Admin read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- cars: all authenticated users can read
CREATE POLICY "Authenticated read cars" ON cars
  FOR SELECT USING (auth.role() = 'authenticated');

-- cars: admin/staff can insert/update/delete
CREATE POLICY "Staff manage cars" ON cars
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- bookings: user sees only own bookings
CREATE POLICY "Own bookings" ON bookings
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- bookings: staff/admin see all bookings
CREATE POLICY "Staff see all bookings" ON bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- bookings: any authenticated user can insert own booking
CREATE POLICY "Insert own booking" ON bookings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- bookings: status update only via Edge Function (service_role bypasses RLS)
```

---

## 4. PDF Report: ใบขออนุญาตใช้รถยนต์

### 4.1 Official Form Layout
```
┌──────────────────────────────────────────────────────────────┐
│           กรมสวัสดิการและคุ้มครองแรงงาน                      │
│              ใบขออนุญาตใช้รถยนต์                              │
│                                  วันที่ __ เดือน __ พ.ศ. __  │
│  เรียน ผู้อำนวยการกองการเจ้าหน้าที่                          │
│  ข้าพเจ้า ______________ ตำแหน่ง __________________________  │
│  กลุ่มงาน/งาน _________________________________________       │
│  ขออนุญาตใช้รถยนต์ (ไปที่ไหน) ___________________________   │
│                              ___________________________      │
│  เพื่อ ________________________________ มีคนนั่ง ___ คน      │
│  ในวันที่ ________ เวลา _____ ถึงวันที่ _______ เวลา ___ น.  │
│  เบอร์ติดต่อ ___________                                     │
│                         ลงชื่อ ________________ ผู้ขออนุญาต  │
│                                   (__________________)        │
│ ───────────────────────────────────────────────────────────  │
│  เห็นควรอนุญาตให้ใช้รถ                                       │
│   □ รถเก๋ง   หมายเลขทะเบียน ___________                     │
│   ☑ รถกระบะ หมายเลขทะเบียน ___________                     │
│   □ รถตู้    หมายเลขทะเบียน ___________                     │
│  โดยมอบหมายให้ ______________ เป็นพนักงานขับรถยนต์           │
│                         ลงชื่อ ________________ ผู้มีอำนาจ   │
│                                   (__________________)        │
│                         นักจัดการงานทั่วไปปฏิบัติการ         │
│ ───────────────────────────────────────────────────────────  │
│  เลขไมล์ก่อนใช้รถ _____ กม.   ออกเวลา _____ น.             │
│  เลขไมล์หลังใช้รถ _____ กม.   ถึงเวลา  _____ น.            │
│  รวมระยะทางที่ใช้ _____ กม.                                  │
│                         ลงชื่อ ________________ พนักงานขับรถ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Implementation Strategy

```
User clicks "ดาวน์โหลด PDF"
        ↓
Mount hidden <div> BookingPdfTemplate with booking data
        ↓
html2canvas({ scale: 2, useCORS: true }) — captures div as canvas
        ↓
jsPDF embeds canvas as A4 image
        ↓
Browser downloads booking_[id].pdf
```

**Why html2canvas and not jsPDF text:** jsPDF's built-in fonts cannot render Thai Unicode.
Capturing an HTML element rendered by the browser (which uses the OS Thai font) is the
only reliable cross-platform approach.

### 4.3 Font Setup
Add to `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```
Apply `font-family: 'Sarabun', sans-serif` to the PDF template div.

### 4.4 Data Fields Mapping
| Form Field | Source | Notes |
|---|---|---|
| วันที่/เดือน/พ.ศ. | `new Date()` Thai Buddhist era | e.g. ๒๐ กุมภาพันธ์ ๒๕๖๘ |
| ข้าพเจ้า | `booking.user_name` | |
| ตำแหน่ง | `booking.user_position` | |
| กลุ่มงาน/งาน | `booking.user_organization` | |
| ไปที่ไหน | `booking.destination` | New field (separate from objective) |
| เพื่อ | `booking.objective` | Purpose/objective |
| มีคนนั่ง | `booking.passenger` | |
| วันที่/เวลาเริ่ม-สิ้นสุด | `booking.date_start/finish + time_start/finish` | |
| เบอร์ติดต่อ | `booking.tel` | |
| ประเภทรถ | `booking.car_type` | Checkbox (รถเก๋ง/รถกระบะ/รถตู้) |
| ทะเบียนรถ | `booking.car_license` | |
| พนักงานขับ | `booking.driver_name` | Filled after staff assigns driver |

### 4.5 PDF Button Visibility
| Role | When shown | Content |
|---|---|---|
| User | After booking submitted (any status) | Requester section filled; approval section blank |
| Staff / Admin | After booking approved | Full form including vehicle + driver |

---

## 5. Supabase Edge Functions (Server-side Operations)

Only operations that require `service_role` or complex validation need Edge Functions.
Simple CRUD goes direct from the frontend Supabase client.

### Functions to create
| Function | Trigger | What it does |
|---|---|---|
| `approve-booking` | Staff clicks Approve | Sets status=approved, assigns driver, logs audit |
| `reject-booking` | Staff clicks Reject | Sets status=rejected, stores reject_reason |
| `create-profile` | Supabase Auth trigger on signup | Creates row in `profiles` table |
| `admin-set-role` | Admin changes user role | Updates profiles.role with service_role |

### Direct Supabase client (no Edge Function needed)
```
GET  cars            → supabase.from('cars').select('*')
POST cars            → supabase.from('cars').insert()     [staff/admin via RLS]
GET  drivers         → supabase.from('drivers').select('*')
GET  bookings        → supabase.from('bookings').select('*, cars(*), drivers(*)')
POST bookings        → supabase.from('bookings').insert()
GET  profile         → supabase.from('profiles').select().eq('id', user.id)
```

---

## 6. Implementation Phases

### Phase 1 — PDF Fix (Highest Priority)
**Goal:** PDF renders correct Thai text matching official ใบขออนุญาตใช้รถยนต์

1. Add Sarabun font `<link>` to `index.html`
2. Create `src/components/BookingPdfTemplate.tsx` — hidden A4 HTML div
3. Rewrite `exportPDF()` in `src/App.tsx` — use html2canvas + jsPDF
4. Add `destination` field to booking form UI
5. Add `destination` column to `bookings` table via SQL migration

**Files changed:**
- `index.html` — add Google Fonts link
- `src/App.tsx` — rewrite exportPDF, add destination field to form
- `src/components/BookingPdfTemplate.tsx` — new file
- `supabase_schema.sql` — add ALTER TABLE migration

---

### Phase 2 — Supabase Auth Migration
**Goal:** Replace custom username/password JWT with Supabase Auth

**Auth strategy:** Use email as the primary auth identifier (department emails).
Keep `username` as a display field in `profiles`. This is standard practice.

1. Create `profiles` table (linked to `auth.users`)
2. Create `create-profile` Edge Function (runs on auth signup → inserts profile row)
3. Replace frontend `handleLogin` / `handleRegister` with:
   - `supabase.auth.signInWithPassword({ email, password })`
   - `supabase.auth.signUp({ email, password, options: { data: { name, position, ... } } })`
4. Replace JWT token storage with Supabase session (`supabase.auth.getSession()`)
5. Replace `Authorization: Bearer <token>` headers with Supabase client (auto-handled)
6. Remove `server.ts` auth routes (login, register, me)
7. Remove `bcryptjs`, `jsonwebtoken` dependencies from root `package.json`

**Migration for existing users:** Run a one-time script to create Supabase Auth users
for each existing row in the `users` table, then seed the `profiles` table.

---

### Phase 3 — Supabase Edge Functions (Booking Operations)
**Goal:** Replace Express booking status routes with Deno Edge Functions

1. Create `supabase/functions/approve-booking/index.ts`
2. Create `supabase/functions/reject-booking/index.ts`
3. Create `supabase/functions/admin-set-role/index.ts`
4. Update frontend to call `supabase.functions.invoke('approve-booking', { body: { booking_id } })`
   instead of `fetch('/api/bookings/:id', { method: 'PATCH' })`
5. Deploy functions: `npx supabase functions deploy approve-booking`

**Edge Function pattern:**
```typescript
// supabase/functions/approve-booking/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  // Verify caller is staff/admin
  // Update booking status
  // Return result
});
```

---

### Phase 4 — Cloudflare Pages Deployment
**Goal:** React app live at custom domain via Cloudflare

#### 4.1 Update `vite.config.ts`
```typescript
// Development: proxy /api to local server.ts (kept for legacy dev)
// Production: no proxy — all calls go direct to Supabase
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: {
    proxy: mode === 'development'
      ? { '/api': 'http://localhost:3000' }
      : {}
  }
}));
```

#### 4.2 Environment variables for Cloudflare Pages
Add in Cloudflare Pages dashboard → Settings → Environment variables:
```
VITE_SUPABASE_URL          = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY     = eyJhbGc...
```
Note: anon key is safe to expose — Supabase RLS enforces access control.

#### 4.3 Update frontend Supabase client
```typescript
// src/lib/supabase.ts (new file)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

#### 4.4 Deploy to Cloudflare Pages
```bash
# Option A: CLI deploy
npm run build
npx wrangler pages deploy dist --project-name driveselect

# Option B: Git integration (recommended)
# Connect GitHub repo → Cloudflare Pages → auto-deploy on push to main
# Build command: npm run build
# Build output: dist
```

#### 4.5 Custom domain via Cloudflare DNS
1. In Cloudflare Pages → Custom domains → Add domain
2. Cloudflare auto-adds CNAME record in DNS
3. SSL is automatic (managed by Cloudflare)

---

### Phase 5 — Supabase Storage for Images
**Goal:** Replace base64 images in DB with Supabase Storage URLs

1. Create storage buckets: `vehicle-images`, `driver-photos` (public read)
2. Update car add/edit form: upload image to Storage, store URL in `cars.photo_url`
3. Update driver add/edit form: upload to Storage, store URL in `drivers.photo_url`
4. Update UI to display `photo_url` instead of base64 `image`
5. Migration: for existing base64 images, convert and upload to Storage

---

## 7. File Changes Summary

### New files to create
```
src/lib/supabase.ts                  ← Supabase client singleton
src/components/BookingPdfTemplate.tsx ← Hidden HTML template for PDF
supabase/functions/
  approve-booking/index.ts           ← Edge Function
  reject-booking/index.ts            ← Edge Function
  create-profile/index.ts            ← Edge Function (Auth trigger)
  admin-set-role/index.ts            ← Edge Function
```

### Files to modify
```
index.html            ← Add Sarabun Google Fonts link
src/App.tsx           ← Replace exportPDF(); add destination field;
                         replace fetch('/api/...') with supabase client calls
vite.config.ts        ← Clean up; keep dev proxy for legacy server.ts
package.json          ← Add VITE_ env prefix; update scripts
supabase_schema.sql   ← Add profiles table, destination column, RLS policies
```

### Files deprecated (kept for local dev only)
```
server.ts             ← No longer used in production; keep for local fallback
```

---

## 8. Local Development Workflow

```bash
# Supabase local dev (optional — can also point to remote project)
npx supabase start

# Run frontend (calls Supabase directly — no local backend needed)
npm run dev

# If using legacy server.ts for local API testing:
npm run dev:server    # tsx server.ts (port 3000)
npm run dev:client    # vite (proxies /api to :3000)
```

Add to `package.json`:
```json
"scripts": {
  "dev": "vite",
  "dev:server": "tsx server.ts",
  "dev:client": "vite",
  "build": "vite build",
  "deploy": "npm run build && npx wrangler pages deploy dist --project-name driveselect",
  "lint": "tsc --noEmit"
}
```

---

## 9. Environment Variables Reference

### Local `.env`
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Legacy local dev server only (not used in production)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
JWT_SECRET=<strong-random-string>
```

### Cloudflare Pages (production env vars)
```
VITE_SUPABASE_URL         ← set in CF Pages dashboard
VITE_SUPABASE_ANON_KEY    ← set in CF Pages dashboard
```

### Supabase Edge Functions (auto-injected, no config needed)
```
SUPABASE_URL               ← injected automatically
SUPABASE_SERVICE_ROLE_KEY  ← injected automatically
SUPABASE_ANON_KEY          ← injected automatically
```

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Thai PDF font broken | Medium | Use html2canvas — browser renders Thai natively via Sarabun |
| Auth migration breaks existing users | Medium | One-time migration script; test in staging first |
| RLS blocks legitimate queries | Medium | Test each RLS policy with different role tokens before go-live |
| Supabase anon key visible in bundle | Low | Acceptable — RLS is the security layer; rotate key if leaked |
| Base64 images too large for Supabase | High | Add 500KB client-side size check; migrate to Storage in Phase 5 |
| Cloudflare Pages build cache stale | Low | Purge cache in CF dashboard after each deploy |

---

## 11. Production Checklist

### Phase 1 (PDF)
- [ ] Sarabun font loads in browser before html2canvas runs
- [ ] `BookingPdfTemplate.tsx` renders all form fields correctly
- [ ] `exportPDF()` uses html2canvas + jsPDF (not jsPDF text)
- [ ] PDF downloads as `booking_[id].pdf`
- [ ] Thai text is readable in downloaded PDF
- [ ] `destination` column added to bookings table

### Phase 2 (Auth)
- [ ] `profiles` table created and linked to `auth.users`
- [ ] `create-profile` Edge Function deployed and tested
- [ ] Login works via `supabase.auth.signInWithPassword()`
- [ ] Register works via `supabase.auth.signUp()`
- [ ] Session persists across page refresh
- [ ] Logout clears session
- [ ] Old `users` table data migrated to `profiles`

### Phase 3 (Edge Functions)
- [ ] `approve-booking` deployed and tested
- [ ] `reject-booking` deployed and tested
- [ ] `admin-set-role` deployed and tested
- [ ] Frontend calls `supabase.functions.invoke()` (not `/api/`)
- [ ] RLS blocks non-staff from approving bookings

### Phase 4 (Cloudflare Pages)
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in CF Pages
- [ ] App loads at `https://<project>.pages.dev`
- [ ] Custom domain CNAME configured in Cloudflare DNS
- [ ] SSL active on custom domain
- [ ] All API calls work on production URL

### Phase 5 (Storage)
- [ ] `vehicle-images` and `driver-photos` buckets created
- [ ] Image upload replaces base64 in car/driver forms
- [ ] `photo_url` column populated for all vehicles and drivers

### Full System Verification
- [ ] Register new user → profile created in Supabase
- [ ] Login → session stored
- [ ] View cars → renders correctly
- [ ] Create booking with destination field → saved to Supabase
- [ ] Staff approves → status changes, driver assigned
- [ ] Staff rejects with reason → status shows rejected
- [ ] Download PDF (user) → Thai text renders, requester section filled
- [ ] Download PDF (staff) → vehicle + driver fields populated
- [ ] User cannot see other users' bookings (RLS)
- [ ] User cannot approve/reject bookings
- [ ] Staff cannot change user roles (admin only)

---

## 12. Future (Phase 3 Backlog)

- [ ] React Native mobile app — uses same Supabase backend
- [ ] Register and Login by Google
- [ ] Mileage tracking — driver fills in เลขไมล์ก่อน/หลัง fields post-trip
- [ ] Email notifications — booking status via Resend / Supabase Email
- [ ] Push notifications — new booking alert for staff (web push)
- [ ] Monthly booking report PDF — admin export
- [ ] Booking calendar view — visual timeline per vehicle
- [ ] Vehicle photo selector — card grid replacing text dropdown
- [ ] Audit log table — track all admin actions

---

## 13. Phase 6 — Admin Module + User Settings

### 13.1 Goal
Add a proper admin module so admins can manage:
- cars
- users
- other admins

And add a self-service settings module so each user can manage their own profile and password.

### 13.2 Product Scope

#### Admin Module
Admin users should be able to:
- create users
- edit users
- deactivate or remove users
- promote/demote roles between `user`, `staff`, and `admin`
- create/edit/remove cars
- manage another admin account

#### User Settings Module
Each authenticated user should be able to:
- edit their own profile fields
- change their own password
- view current account information

### 13.3 Role Rules
| Role | Cars | Users | Admins | Own Settings |
|---|---|---|---|---|
| `user` | Read only | No access | No access | Yes |
| `staff` | Optional read/manage based on policy | No access | No access | Yes |
| `admin` | Full CRUD | Full CRUD | Full CRUD with safeguards | Yes |

### 13.4 Admin Module Design

#### Admin Navigation
Extend the admin view with a `users` management tab in addition to:
- approvals
- bookings
- cars
- drivers

#### User Management Screen
Add a dedicated admin screen to:
- list all profiles
- search/filter by name, email, role, active status
- open create/edit modal
- assign role
- toggle active/inactive status
- delete user account

#### Safeguards
To avoid locking the system:
- admin cannot delete themselves accidentally without confirmation
- admin cannot remove the last active admin
- destructive actions require confirmation UI

### 13.5 User Settings Module Design

#### Settings Screen
Add a user settings screen reachable from the main authenticated layout.

Sections:
- Profile
- Password
- Account Status

#### Editable Fields
The user should be able to update:
- name
- position
- organization
- internal phone
- mobile phone
- display name (if retained separately in live schema)

#### Password Change
Use `supabase.auth.updateUser({ password })` for authenticated password updates.

### 13.6 Database / Schema Impact

#### `profiles` table
Use `profiles` as the source of truth for:
- role
- active status
- profile fields

Recommended fields to support admin/settings module:
```sql
-- already present or partially present in live schema
role                 TEXT
is_active            BOOLEAN
must_change_password BOOLEAN
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```

If `updated_at` does not exist in the live schema, add it in this phase.

### 13.7 API / Edge Function Design

#### New Admin Functions
Create dedicated admin-only Edge Functions for high-risk actions:
- `admin-create-user`
- `admin-update-user`
- `admin-delete-user`
- `admin-set-role`
- `admin-reset-password` (optional if temp-password onboarding is needed)

#### Why Edge Functions
These actions require `service_role` access because they may touch:
- `auth.users`
- `profiles`
- role promotion/demotion
- account deletion

### 13.8 Frontend File Impact

Likely files to add:
```text
src/components/admin/UserManagementPanel.tsx
src/components/settings/UserSettingsPanel.tsx
supabase/functions/admin-create-user/index.ts
supabase/functions/admin-update-user/index.ts
supabase/functions/admin-delete-user/index.ts
```

Likely files to modify:
```text
src/App.tsx
supabase_schema.sql
doc/Todo.md
Plan.md
```

### 13.9 Acceptance Criteria
- Admin can create a new user account
- Admin can edit a user profile
- Admin can deactivate or remove a user
- Admin can promote another account to `admin`
- Admin can edit/remove cars from admin module
- Another admin can perform the same admin tasks
- User can open settings and update their own profile
- User can change their own password successfully
- Non-admin users cannot access admin user-management features

---

*End of Plan — v3.1*

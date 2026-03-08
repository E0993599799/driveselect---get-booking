# Implementation Plan (Vehicle Booking System + Admin Modules + UI Fixes)

## Defaults (MVP)
- `approval_required = true` — bookings start as `pending`, require staff approval. (existing baseline) 
- `pickup_grace_minutes = 30` — `pickup_deadline_at = start_at + 30 min`. (existing baseline)

---

## Stage 1: Scan (Requirements + Repo Alignment)

**Goal**: Confirm scope and map requirements to modules/files.

**Inputs**:
- Current README scope + lifecycle + roles (member/staff/admin).
- New requested items:
  - Orchestrator “Admin module” (create/edit/remove/inactive), user + role management
  - Vehicle module
  - Report module
  - Vehicle selection UI: dropdown → picture selector (photo + name)
  - Calendar UI bug: date/time text blends with background (unreadable)

**Outputs**:
- Updated `/docs/plan.md` (this file)
- New `/docs/todo.md`
- Feature→file map update (if you keep a `WHERE_TO_EDIT.md`)

**Stop Criteria**:
- All new requirements mapped to a concrete module + route + data model change list.

---

## Stage 2: Plan (Data Model + RLS + API Contracts + UI Contracts)

### 2.1 Modules & Routes
**Frontend routes (suggested)**
- `/auth/*` — login/register
- `/bookings` — member booking list + create booking
- `/staff` — approve + dispatch (checkout/checkin)
- `/admin` — admin dashboard (vehicles + users/roles + reports)

### 2.2 Data Model (Additions / Checks)
Existing baseline includes bookings lifecycle + roles. Extend with:

**Vehicles**
- `vehicles` table must include:
  - `id`
  - `name`
  - `photo_url` (for picture selector)
  - `is_active` (inactive vehicles hidden for members)
  - optional: `plate_no`, `type`, `seats`, `notes`

**Admin / Identity**
- `profiles` (or equivalent) must include:
  - `user_id`
  - `role` (`member` | `staff` | `admin`)
  - `is_active` (soft disable account, default true)
- Audit log table required for admin operations (already mentioned in baseline docs).

**Report**
- Define report views/queries (MVP):
  - booking counts by status/date
  - vehicle utilization (hours booked)
  - cancellations/expired rates

### 2.3 RLS Rules (High-level)
- `vehicles`: readable by all authenticated if `is_active = true`; admin can read all; admin can write.
- `bookings`: member can CRUD only own bookings (and only cancel while pending/approved); staff/admin can read all + update status fields.
- `profiles`: user can read own profile; admin can read/update roles and `is_active`.
- `audit_logs`: staff/admin readable; write-only via server-side (Edge Functions) preferred.

### 2.4 Edge Function Contracts (Existing + Additions)
Keep existing booking function contracts, plus add admin/report endpoints.

**Booking functions (existing baseline)**
- `create_booking` (POST)
- `approve_booking` (POST)
- `checkout_booking` (POST)
- `checkin_booking` (POST)
- `expire_bookings` (POST) — scheduler

**Admin functions (new)**
| Function            | Method | Auth     | Body               | Returns      |
|---|---:|---|---|---|
| `admin_get_reports` | GET | admin JWT | `?from=...&to=...` | `{success, data: {...}}` |
| `admin_upsert_vehicle` | POST | admin JWT | `{id?, name, photo_url, is_active, ...}` | `{success, data: Vehicle}` |
| `admin_set_vehicle_active` | POST | admin JWT | `{vehicle_id, is_active}` | `{success}` |
| `admin_set_user_role` | POST | admin JWT | `{user_id, role}` | `{success}` |
| `admin_set_user_active` | POST | admin JWT | `{user_id, is_active}` | `{success}` |

**Report functions (MVP)**
| Function | Method | Auth | Query/Body | Returns |
|---|---:|---|---|---|
| `report_summary` | GET | staff/admin JWT | `?from=...&to=...` | `{success, data: {...}}` |
| `report_vehicle_utilization` | GET | staff/admin JWT | `?from=...&to=...` | `{success, data: [...]}` |
| `report_bookings_by_date_range` | GET | staff/admin JWT | `?from=...&to=...` | `{success, data: [...]}` |
### 2.5 UI Contracts
**Vehicle picture selector**
- Replace `<select>` with a grid/list of cards:
  - card shows vehicle photo + name + status badge (active/inactive)
  - selectable state (border highlight)
  - keyboard accessible (tab + enter)

**Calendar text contrast bug**
- Ensure calendar date/time text color contrasts with background:
  - enforce text color tokens (`text-slate-900 dark:text-slate-100`)
  - avoid same-color foreground/background
  - confirm in both light/dark themes if supported

**Stop Criteria**
- All schema changes listed
- RLS policy intent written
- All endpoints listed with inputs/outputs
- UI acceptance criteria written

---

## Stage 3: Build (DB → Functions → UI → Reports)

### 3.1 Database Sensitive Fields Encryption
- Add/extend tables (`vehicles.photo_url`, `vehicles.is_active`, `profiles.is_active`, report views if needed)
- Write migrations / SQL scripts
- Add RLS policies + minimal seed

### 3.2 Edge Functions
- Implement new admin endpoints with strict role checks
- Add report endpoints (read-only)
- Ensure audit log writes for admin actions

### 3.3 Frontend
- Admin page:
  - Reports page with filters + CSV export
  - Vehicles CRUD + activate/deactivate
  - Users list + set role + activate/deactivate
- Booking create:
  - vehicle picture selector (uses `photo_url`)
- Calendar component:
  - fix contrast + verify readability

### 3.4 QA + Validation
- Role-based access tests:
  - member blocked from admin routes and endpoints
  - staff blocked from admin write endpoints (added role checks)
- UI tests:
  - picture selector works on mobile/desktop
  - calendar text readable in all states

**Stop Criteria**
- All flows pass QA checklist (add new cases for admin/report + UI fixes)

---

## Stage 4: Validate (End-to-End)
- Manual test checklist updated:
  - vehicle CRUD
  - user role changes
  - user deactivate/reactivate behavior
  - report endpoints return expected aggregates
  - calendar readability fixed

---

## Stage 5: Report (Docs)
- Update README “Features” and “Admin / Reports”
- Add screenshots for picture selector + admin screens (optional)

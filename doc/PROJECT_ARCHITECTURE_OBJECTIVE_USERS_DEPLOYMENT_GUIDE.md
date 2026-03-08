# PROJECT ARCHITECTURE, OBJECTIVE, USERS, AND DEPLOYMENT GUIDE

## 1) Project Architecture (DriveSelect)

This project is a vehicle booking system with this architecture:

- Frontend: React + TypeScript + Vite (`src/`)
- Data/Auth: Supabase (PostgreSQL + Supabase Auth + RLS)
- Optional/legacy backend: Express API (`server.ts`) for local or older flow
- Deployment target (current): Cloudflare Pages for frontend

High-level flow:

1. User signs in/up with Supabase Auth.
2. App loads user profile from `profiles` table.
3. App reads/writes booking data directly to Supabase tables (`cars`, `drivers`, `bookings`) based on RLS permissions.
4. Admin/Staff roles manage approvals, vehicles, and drivers.

Database schema source:

- `supabase_schema.sql`

## 2) Short Brief

### Objective
Build a simple, fast, and controlled internal system for requesting and approving vehicle usage.

### Who uses this

- Employee/User: creates booking requests
- Staff: reviews and manages operational records
- Admin: full control (users/roles, approval, records)

### Why they use this

- Remove manual/fragmented booking process
- Track request status clearly (pending/approved/rejected)
- Keep vehicle + driver assignment in one place
- Export booking evidence (PDF)

### What they use it for

- Create vehicle booking requests
- Approve/reject requests
- Assign drivers and maintain fleet data
- Check booking history and status

## 3) Deployment (Step by Step)

### A. Prerequisites

1. Install Node.js 18+ and npm.
2. Have a Supabase project ready.
3. Install/prepare Cloudflare account (for Pages deployment).

### B. Project setup

1. Open terminal in project root: `driveselect---get-booking`
2. Install dependencies:
   - `npm install`
3. Create `.env` from `.env.example`.
4. Set required values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (optional for legacy server) `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`

### C. Supabase setup

1. Open Supabase SQL editor.
2. Run `supabase_schema.sql`.
3. Confirm tables exist: `profiles`, `cars`, `drivers`, `bookings`.
4. Ensure RLS policies are applied from the same SQL file.

### D. Local development run

1. Start frontend dev server:
   - `npm run dev`
2. Open local URL shown by Vite (normally `http://localhost:5173`).
3. Register/login and test basic booking flow.

Optional (legacy API path):

- Run backend server with `npm run dev:server` (serves on port 3000).

### E. Production build

1. Build frontend:
   - `npm run build`
2. Output is generated in `dist/`.

### F. Deploy to Cloudflare Pages

1. Authenticate Wrangler (first time):
   - `npx wrangler login`
2. Deploy using existing script:
   - `npm run deploy`
3. Script command used:
   - `npx wrangler pages deploy dist --project-name driveselect`
4. In Cloudflare Pages project settings, set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Re-deploy if environment variables were added after first deploy.

### G. Post-deploy validation

1. Open deployed URL.
2. Test login/register.
3. Create a booking request.
4. Verify staff/admin approval workflow.
5. Confirm data is persisted in Supabase.

## 4) End Credit

DriveSelect vehicle booking project.
Built for internal fleet booking and approval workflow.
Thanks to all contributors: product owner, developers, and testers.

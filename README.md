# DriveSelect

Vehicle booking app built with Vite, React, TypeScript, and Supabase.

## Stack

- Frontend: React 19 + Vite
- Data/Auth: Supabase (Postgres, Auth, Edge Functions, RLS)
- Optional local legacy server: `server.ts`
- Deployment: Cloudflare Pages + Supabase

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example`.
3. Set the required frontend env vars:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Apply the Supabase schema/migrations to the linked project.
5. Deploy the `create-profile` Edge Function if you want the Auth webhook path enabled.

## Auth Notes

- Primary signup is email-based Supabase Auth.
- Login accepts email, and can also accept legacy username aliases through `VITE_AUTH_USERNAME_DOMAIN`.
- New users need a row in `public.profiles`. This repo now supports both:
  - the `create-profile` Edge Function / Auth webhook path
  - a direct client-side self-insert fallback allowed by RLS

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## Deploy

```bash
npx supabase db push --linked
npx supabase functions deploy create-profile
npx wrangler pages deploy dist --project-name driveselect
```

## Docs

- [Plan.md](./Plan.md)
- [doc/Todo.md](./doc/Todo.md)
- [doc/PROJECT_ARCHITECTURE_OBJECTIVE_USERS_DEPLOYMENT_GUIDE.md](./doc/PROJECT_ARCHITECTURE_OBJECTIVE_USERS_DEPLOYMENT_GUIDE.md)

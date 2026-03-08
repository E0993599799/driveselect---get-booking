Auth components
===============

This folder provides simple components for registration and password flows using the existing Supabase client.

Files
- `Register.tsx` — registration form (calls `supabase.auth.signUp`).
- `ForgotPassword.tsx` — request password reset (calls `supabase.auth.resetPasswordForEmail`).
- `ResetPassword.tsx` — set new password after following recovery link (calls `supabase.auth.updateUser`).

Usage
- Import the components into your auth pages and render them. Ensure `src/lib/supabase.ts` exports the `supabase` client and that environment variables are set.

Notes
- Supabase must be configured to send emails (SMTP provider in project settings) for reset/confirm emails to be delivered.
- The `ResetPassword` component assumes the Supabase SDK has handled the recovery link/token exchange. If you use a custom flow, extract the `access_token` from the URL and sign in the user session before rendering the component.

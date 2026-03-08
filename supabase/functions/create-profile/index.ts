// Supabase Edge Function: create-profile
// Trigger: Called as an Auth Webhook on user signup
// Action: Inserts a row into the `profiles` table from auth.users metadata

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const payload = await req.json();

    // Support both Auth Webhook (payload.record) and direct call (payload.user)
    const user = payload.record ?? payload.user;
    if (!user?.id || !user?.email) {
      return new Response(
        JSON.stringify({ error: 'Missing user id or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meta = user.raw_user_meta_data ?? {};

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        user_id: user.id,
        email: user.email,
        name: meta.name ?? user.email.split('@')[0],
        display_name: meta.name ?? user.email.split('@')[0],
        position: meta.position ?? null,
        organization: meta.organization ?? null,
        internal_tel: meta.internal_tel ?? null,
        mobile_tel: meta.mobile_tel ?? null,
        role: 'user',
        must_change_password: false,
        is_active: true,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('create-profile error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-profile exception:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

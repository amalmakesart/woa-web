import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { record } = await req.json();
  if (!record?.user_id) return new Response('ok');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', record.user_id)
    .single();

  const token = (profile as any)?.push_token;
  if (!token || !token.startsWith('ExponentPushToken')) {
    return new Response('no token');
  }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: 'WOA',
      body: record.preview_text ?? 'You have a new notification',
      data: {
        type: record.type,
        reference_id: record.reference_id
      },
    }),
  });

  return new Response('sent');
});

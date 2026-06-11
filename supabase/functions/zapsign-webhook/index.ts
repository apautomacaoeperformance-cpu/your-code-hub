import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log('ZapSign webhook payload:', JSON.stringify(payload));

    const documentToken = payload.token || payload.open_id?.toString();
    const event = payload.event_type || payload.status;

    if (!documentToken) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let status = 'pending';
    if (event === 'doc_signed' || payload.status === 'signed') status = 'signed';
    else if (event === 'doc_refused' || payload.status === 'refused') status = 'refused';

    const update: Record<string, any> = {
      status,
      raw_payload: payload,
    };
    if (status === 'signed') {
      update.signed_at = new Date().toISOString();
      update.signed_file_url = payload.signed_file || payload.signed_file_url;
    }

    const { error } = await admin
      .from('zapsign_documents')
      .update(update)
      .eq('document_token', documentToken);

    if (error) console.error('Update error', error);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

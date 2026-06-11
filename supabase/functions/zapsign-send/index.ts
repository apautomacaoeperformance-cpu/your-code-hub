import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ZAPSIGN_API = 'https://api.zapsign.com.br/api/v1/docs/upload/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { debenturista_id, base64_pdf, signer_name, signer_email, doc_name } = body;

    if (!debenturista_id || !base64_pdf || !signer_name || !signer_email) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiToken = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'ZAPSIGN_API_TOKEN não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const zapPayload = {
      name: doc_name || 'Termo de Investidor Qualificado',
      base64_pdf,
      signers: [{
        name: signer_name,
        email: signer_email,
        auth_mode: 'assinaturaTela',
        send_automatic_email: true,
      }],
      lang: 'pt-br',
      disable_signer_emails: false,
      brand_primary_color: '#192d4d',
    };

    const zapRes = await fetch(ZAPSIGN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(zapPayload),
    });

    const zapData = await zapRes.json();
    if (!zapRes.ok) {
      console.error('ZapSign error', zapRes.status, zapData);
      return new Response(JSON.stringify({ error: 'Erro ZapSign', details: zapData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const documentToken = zapData.token || zapData.open_id?.toString();
    const signerToken = zapData.signers?.[0]?.token;
    const originalUrl = zapData.original_file;

    // Insert via service role to bypass RLS for created_by
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error: insErr } = await admin.from('zapsign_documents').insert({
      debenturista_id,
      document_token: documentToken,
      signer_token: signerToken,
      signer_email,
      signer_name,
      status: 'pending',
      original_file_url: originalUrl,
      created_by: userId,
      raw_payload: zapData,
    });
    if (insErr) console.error('Insert error', insErr);

    return new Response(JSON.stringify({
      ok: true,
      document_token: documentToken,
      sign_url: zapData.signers?.[0]?.sign_url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

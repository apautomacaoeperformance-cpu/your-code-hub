import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const WEBHOOK_URL =
  Deno.env.get("N8N_WEBHOOK_DEBENTURE") ??
  "https://quotus-n8n.prrkvv.easypanel.host/webhook/debenture-adquirida";

interface Body {
  debenture_id: string;
  debenturista_id: string;
  venda_ids?: string[];
  quantidade_cotas: number;
  valor_investido: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // valida JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.debenture_id || !body?.debenturista_id) {
      return json({ error: "debenture_id e debenturista_id são obrigatórios" }, 400);
    }

    const [{ data: deb }, { data: deb_ista }] = await Promise.all([
      supabase
        .from("debentures")
        .select("nome,serie,emissao,taxa,tipo_taxa")
        .eq("id", body.debenture_id)
        .maybeSingle(),
      supabase
        .from("debenturistas")
        .select("nome,email")
        .eq("id", body.debenturista_id)
        .maybeSingle(),
    ]);

    if (!deb || !deb_ista) return json({ error: "Registros não encontrados" }, 404);

    const taxaNum = Number(deb.taxa ?? 0);
    const tipoTaxa = (deb.tipo_taxa ?? "").toString().toUpperCase();
    const rentabilidade =
      tipoTaxa === "FIXA"
        ? `${taxaNum.toFixed(2)}% a.a.`
        : `${taxaNum.toFixed(2)}% ${tipoTaxa}`.trim();

    const debentureCompleta = `${deb.nome} - ${rentabilidade}`;

    const payload = {
      nome: deb_ista.nome,
      email: deb_ista.email,
      debenture: debentureCompleta,
      rentabilidade,
      quantidade_cotas: body.quantidade_cotas,
      valor_investido: body.valor_investido,
    };

    let status_code: number | null = null;
    let response_body: unknown = null;
    let error_msg: string | null = null;

    try {
      const r = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      status_code = r.status;
      const text = await r.text();
      try {
        response_body = JSON.parse(text);
      } catch {
        response_body = { raw: text };
      }
      if (!r.ok) error_msg = `HTTP ${r.status}`;
    } catch (e) {
      error_msg = (e as Error).message;
    }

    await supabase.from("integrations_log").insert({
      integration: "n8n.debenture-adquirida",
      reference_id: body.debenturista_id,
      payload: payload as never,
      response: response_body as never,
      status_code,
      error: error_msg,
    });

    if (error_msg) return json({ ok: false, error: error_msg, status_code }, 502);
    return json({ ok: true, status_code, response: response_body });
  } catch (e) {
    console.error("notify-debenture-acquired error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

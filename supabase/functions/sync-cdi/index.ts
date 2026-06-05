import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function fmtBR(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Determina a data inicial: última data em cdi_diario + 1, ou últimos 3 anos
    const { data: last } = await supabase
      .from("cdi_diario")
      .select("data")
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    const today = new Date();
    // Janela de re-sincronização: sempre re-busca os últimos N dias para capturar
    // republicações/correções do BCB (backfill automático via upsert).
    const BACKFILL_DAYS = 10;
    let start: Date;
    if (last?.data) {
      start = new Date(last.data + "T00:00:00");
      // Recua N dias a partir da última data salva para sobrescrever correções recentes
      start.setDate(start.getDate() - BACKFILL_DAYS);
    } else {
      start = new Date(today);
      start.setFullYear(start.getFullYear() - 3);
    }

    if (start > today) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, message: "Already up to date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BCB SGS série 12 = CDI diário (% a.d.)
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${fmtBR(start)}&dataFinal=${fmtBR(today)}`;
    const resp = await fetch(url);
    // BCB retorna 404 quando não há dados publicados no intervalo (fins de semana, feriados, ou dia ainda não publicado)
    if (resp.status === 404) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, message: "Nenhum dado novo publicado pelo BCB no intervalo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`BCB API failed [${resp.status}]: ${body}`);
    }
    const rows: { data: string; valor: string }[] = await resp.json();

    if (!rows.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const records = rows.map((r) => {
      const [d, m, y] = r.data.split("/");
      return { data: `${y}-${m}-${d}`, taxa: Number(r.valor) };
    });

    // Identifica datas que já pertencem a meses consolidados — não devem ser sobrescritas
    // (alterações nessas datas geram registro em cdi_auditoria sem afetar histórico contábil).
    const datas = records.map((r) => r.data);
    const { data: rendConsolidados } = await supabase
      .from("rendimentos_debenture")
      .select("data_competencia")
      .eq("consolidado", true);
    const mesesConsolidados = new Set<string>(
      (rendConsolidados ?? []).map((r: any) => String(r.data_competencia).slice(0, 7)),
    );

    const protegidos: { data: string; taxa: number }[] = [];
    const atualizaveis: { data: string; taxa: number }[] = [];
    for (const r of records) {
      if (mesesConsolidados.has(r.data.slice(0, 7))) protegidos.push(r);
      else atualizaveis.push(r);
    }

    if (atualizaveis.length > 0) {
      const { error } = await supabase.from("cdi_diario").upsert(atualizaveis, { onConflict: "data" });
      if (error) throw error;
    }

    // Para datas em meses consolidados, faz insert apenas se não existir (não sobrescreve).
    if (protegidos.length > 0) {
      const { data: jaExistem } = await supabase
        .from("cdi_diario")
        .select("data")
        .in("data", protegidos.map((r) => r.data));
      const existentes = new Set<string>((jaExistem ?? []).map((r: any) => r.data as string));
      const novos = protegidos.filter((r) => !existentes.has(r.data));
      if (novos.length > 0) {
        const { error } = await supabase.from("cdi_diario").insert(novos);
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted: records.length, from: records[0].data, to: records[records.length - 1].data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-cdi error", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

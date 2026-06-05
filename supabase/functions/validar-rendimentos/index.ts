import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Cálculo de rendimento (CDI ou FIXA) — replicado da função gerar-rendimentos-mensais
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoAdd = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
};

function calcularPeriodo(opts: {
  tipoTaxa: string;
  rentAnual: number;
  inicioExclusivoIso: string;
  fimInclusivoIso: string;
  feriados: Set<string>;
  cdi: Map<string, number>;
}) {
  let cur = isoAdd(opts.inicioExclusivoIso, 1);
  let fator = 1;
  if (opts.tipoTaxa === "CDI") {
    const pct = (opts.rentAnual || 100) / 100;
    let last = 0;
    const sorted = Array.from(opts.cdi.keys()).sort();
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] <= cur) { last = opts.cdi.get(sorted[i]) || 0; break; }
    }
    while (cur <= opts.fimInclusivoIso) {
      const dt = new Date(cur + "T00:00:00");
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6 && !opts.feriados.has(cur)) {
        const t = opts.cdi.get(cur);
        if (t != null) last = t;
        const usar = t ?? last;
        if (usar > 0) fator *= Math.pow(1 + usar / 100, pct);
      }
      cur = isoAdd(cur, 1);
    }
  } else {
    const td = Math.pow(1 + (opts.rentAnual || 0) / 100, 1 / 252) - 1;
    while (cur <= opts.fimInclusivoIso) {
      const dt = new Date(cur + "T00:00:00");
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6 && !opts.feriados.has(cur)) {
        fator *= 1 + td;
      }
      cur = isoAdd(cur, 1);
    }
  }
  return fator;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pega últimos 12 meses de rendimentos consolidados e recalcula
    const hoje = new Date();
    const desde = new Date(hoje.getFullYear(), hoje.getMonth() - 12, 1);
    const desdeIso = toIso(desde);

    const { data: rendimentos, error: errR } = await supabase
      .from("rendimentos_debenture")
      .select("id, venda_id, debenture_id, data_competencia, rendimento_bruto, tipo_calculo, consolidado")
      .eq("consolidado", true)
      .gte("data_competencia", desdeIso);
    if (errR) throw errR;

    if (!rendimentos || rendimentos.length === 0) {
      return new Response(JSON.stringify({ ok: true, verificados: 0, divergencias: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: feriadosRows } = await supabase.from("feriados").select("data");
    const feriados = new Set<string>((feriadosRows ?? []).map((r: any) => r.data as string));

    const { data: cdiRows } = await supabase.from("cdi_diario").select("data, taxa").gte("data", desdeIso);
    const cdi = new Map<string, number>(
      (cdiRows ?? []).map((r: any) => [r.data as string, Number(r.taxa)]),
    );

    const vendaIds = [...new Set(rendimentos.map((r: any) => r.venda_id))];
    const { data: vendas } = await supabase
      .from("vendas_debenture")
      .select("id, valor, data_venda, debenture:debenture_id(rentabilidade_anual, tipo_taxa)")
      .in("id", vendaIds);
    const vendasMap = new Map((vendas ?? []).map((v: any) => [v.id, v]));

    const divergencias: any[] = [];
    const TOLERANCIA = 0.05; // R$ 0,05

    for (const r of rendimentos as any[]) {
      const v = vendasMap.get(r.venda_id);
      if (!v) continue;
      const dataVendaIso = v.data_venda as string;
      const dataVenda = new Date(dataVendaIso + "T00:00:00");
      const fimMesIso = r.data_competencia as string;
      const fimMes = new Date(fimMesIso + "T00:00:00");
      const inicioMes = new Date(fimMes.getFullYear(), fimMes.getMonth(), 1);
      const inicioMesIso = toIso(inicioMes);
      const inicioExclusivoIso = dataVenda > inicioMes ? dataVendaIso : isoAdd(inicioMesIso, -1);

      const deb = (v as any).debenture || {};
      const tipoTaxa = String(deb.tipo_taxa || "FIXA").toUpperCase();
      const rentAnual = Number(deb.rentabilidade_anual || 0);
      const fator = calcularPeriodo({
        tipoTaxa, rentAnual, inicioExclusivoIso,
        fimInclusivoIso: fimMesIso, feriados, cdi,
      });
      const esperado = Number((Number(v.valor || 0) * (fator - 1)).toFixed(2));
      const gravado = Number(r.rendimento_bruto);
      const diff = Math.abs(esperado - gravado);
      if (diff > TOLERANCIA) {
        divergencias.push({
          rendimento_id: r.id,
          venda_id: r.venda_id,
          data_competencia: fimMesIso,
          tipo_calculo: r.tipo_calculo,
          gravado, esperado, diferenca: Number((esperado - gravado).toFixed(2)),
        });
      }
    }

    // Loga em integrations_log para histórico
    await supabase.from("integrations_log").insert({
      integration: "validar-rendimentos",
      payload: { verificados: rendimentos.length, divergencias: divergencias.length },
      response: { divergencias },
    } as any).catch(() => null);

    return new Response(
      JSON.stringify({ ok: true, verificados: rendimentos.length, divergencias }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("validar-rendimentos error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

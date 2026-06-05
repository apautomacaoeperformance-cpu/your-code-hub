import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Alíquota IR (renda fixa) por prazo em dias corridos
const aliquotaIR = (dias: number) => {
  if (dias <= 180) return 22.5;
  if (dias <= 360) return 20;
  if (dias <= 720) return 17.5;
  return 15;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isoAdd = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
};

// Conta dias úteis e devolve fator acumulado conforme tipo de taxa
function calcularPeriodo(opts: {
  tipoTaxa: string;
  rentAnual: number; // FIXA: % a.a. | CDI: % do CDI (ex: 100, 110)
  inicioExclusivoIso: string; // dia anterior ao primeiro dia de cálculo
  fimInclusivoIso: string;
  feriados: Set<string>;
  cdi: Map<string, number>; // iso -> % a.d.
}) {
  let cur = isoAdd(opts.inicioExclusivoIso, 1);
  let fator = 1;
  let du = 0;

  if (opts.tipoTaxa === "CDI") {
    const pct = (opts.rentAnual || 100) / 100;
    // taxa "última conhecida" para dias úteis sem publicação ainda
    let lastCdi = 0;
    const sorted = Array.from(opts.cdi.keys()).sort();
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] <= cur) { lastCdi = opts.cdi.get(sorted[i]) || 0; break; }
    }
    while (cur <= opts.fimInclusivoIso) {
      const dt = new Date(cur + "T00:00:00");
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6 && !opts.feriados.has(cur)) {
        const t = opts.cdi.get(cur);
        if (t != null) lastCdi = t;
        const usar = t ?? lastCdi;
        if (usar > 0) fator *= Math.pow(1 + usar / 100, pct);
        du++;
      }
      cur = isoAdd(cur, 1);
    }
  } else {
    // FIXA — base 252
    const taxaDiaria = Math.pow(1 + (opts.rentAnual || 0) / 100, 1 / 252) - 1;
    while (cur <= opts.fimInclusivoIso) {
      const dt = new Date(cur + "T00:00:00");
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6 && !opts.feriados.has(cur)) {
        fator *= 1 + taxaDiaria;
        du++;
      }
      cur = isoAdd(cur, 1);
    }
  }

  return { fator, du };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }

    const hoje = new Date();
    const ano = Number(body?.ano) || (hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear());
    const mes = Number(body?.mes) || (hoje.getMonth() === 0 ? 12 : hoje.getMonth());
    const consolidar = body?.consolidar !== false; // padrão: consolida o mês

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0);
    const inicioMesIso = toIso(inicioMes);
    const fimMesIso = toIso(fimMes);

    // Feriados
    const { data: feriadosRows, error: errF } = await supabase.from("feriados").select("data");
    if (errF) throw errF;
    const feriados = new Set<string>((feriadosRows ?? []).map((r: any) => r.data as string));

    // CDI diário (carrega tudo do período + margem de 5 dias antes para fallback)
    const inicioCdi = new Date(inicioMes);
    inicioCdi.setDate(inicioCdi.getDate() - 5);
    const { data: cdiRows, error: errC } = await supabase
      .from("cdi_diario")
      .select("data, taxa")
      .gte("data", toIso(inicioCdi))
      .lte("data", fimMesIso);
    if (errC) throw errC;
    const cdi = new Map<string, number>(
      (cdiRows ?? []).map((r: any) => [r.data as string, Number(r.taxa)]),
    );

    const { data: vendas, error: errV } = await supabase
      .from("vendas_debenture")
      .select("id, debenture_id, debenturista_id, valor, data_venda, debenture:debenture_id(rentabilidade_anual, tipo_taxa)");
    if (errV) throw errV;

    const snapshots: any[] = [];
    for (const v of vendas ?? []) {
      if (!v.debenturista_id) continue;
      const dataVendaIso = v.data_venda as string;
      if (!dataVendaIso) continue;
      const dataVenda = new Date(dataVendaIso + "T00:00:00");
      if (dataVenda > fimMes) continue;

      // início exclusivo: dia anterior ao primeiro dia de cálculo
      const inicioExclusivoIso = dataVenda > inicioMes
        ? dataVendaIso // começa a contar no dia seguinte à venda
        : isoAdd(inicioMesIso, -1); // começa a contar a partir do dia 1

      const deb = (v as any).debenture || {};
      const tipoTaxa = String(deb.tipo_taxa || "FIXA").toUpperCase();
      const rentAnual = Number(deb.rentabilidade_anual || 0);
      const valor = Number(v.valor || 0);

      const { fator, du } = calcularPeriodo({
        tipoTaxa,
        rentAnual,
        inicioExclusivoIso,
        fimInclusivoIso: fimMesIso,
        feriados,
        cdi,
      });
      if (du === 0) continue;

      const rendBruto = valor * (fator - 1);
      const diasDesdeVenda = Math.floor((fimMes.getTime() - dataVenda.getTime()) / 86400000);
      const aliq = aliquotaIR(diasDesdeVenda);
      const ir = rendBruto * (aliq / 100);

      snapshots.push({
        venda_id: v.id,
        debenture_id: v.debenture_id,
        debenturista_id: v.debenturista_id,
        data_competencia: fimMesIso,
        dias_uteis_periodo: du,
        rendimento_bruto: Number(rendBruto.toFixed(2)),
        aliquota_ir: aliq,
        valor_ir_retido: Number(ir.toFixed(2)),
        rendimento_liquido: Number((rendBruto - ir).toFixed(2)),
        tipo_calculo: tipoTaxa,
        consolidado: consolidar,
      });
    }

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({ ok: true, criados: 0, data_competencia: fimMesIso }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Para não violar a trigger de imutabilidade, fazemos upsert apenas
    // sobre registros NÃO consolidados. Os já consolidados são preservados.
    // Buscamos os existentes desse mês e filtramos.
    const vendaIds = snapshots.map((s) => s.venda_id);
    const { data: existentes, error: errEx } = await supabase
      .from("rendimentos_debenture")
      .select("id, venda_id, consolidado")
      .eq("data_competencia", fimMesIso)
      .in("venda_id", vendaIds);
    if (errEx) throw errEx;

    const consolidadosSet = new Set(
      (existentes ?? []).filter((r: any) => r.consolidado).map((r: any) => r.venda_id as string),
    );
    const idsPorVenda = new Map<string, string>(
      (existentes ?? []).map((r: any) => [r.venda_id as string, r.id as string]),
    );

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    let preservados = 0;
    for (const s of snapshots) {
      if (consolidadosSet.has(s.venda_id)) { preservados++; continue; }
      const existingId = idsPorVenda.get(s.venda_id);
      if (existingId) toUpdate.push({ id: existingId, ...s });
      else toInsert.push(s);
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from("rendimentos_debenture").insert(toInsert);
      if (error) throw error;
    }
    for (const r of toUpdate) {
      const { id, ...patch } = r;
      const { error } = await supabase.from("rendimentos_debenture").update(patch).eq("id", id);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ano, mes,
        data_competencia: fimMesIso,
        inseridos: toInsert.length,
        atualizados: toUpdate.length,
        preservados_consolidados: preservados,
        consolidar,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("gerar-rendimentos-mensais error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

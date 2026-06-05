import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isoAdd = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
};

const aliquotaIR = (dias: number) => {
  if (dias <= 180) return 22.5;
  if (dias <= 360) return 20;
  if (dias <= 720) return 17.5;
  return 15;
};

function calcularFator(opts: {
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

    const body = await req.json();
    const { venda_id, data_retirada, caixa_id, observacoes } = body || {};
    if (!venda_id || !data_retirada || !caixa_id) {
      return new Response(JSON.stringify({ error: "venda_id, data_retirada e caixa_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Carrega venda + debenture
    const { data: venda, error: errV } = await supabase
      .from("vendas_debenture")
      .select("id, debenture_id, debenturista_id, valor, data_venda, debenture:debenture_id(tipo_taxa, rentabilidade_anual, tipo_retirada)")
      .eq("id", venda_id)
      .single();
    if (errV) throw errV;
    if (!venda) throw new Error("Venda não encontrada");
    if (!venda.debenturista_id) throw new Error("Venda sem debenturista");

    const deb: any = (venda as any).debenture || {};
    const tipoTaxa = String(deb.tipo_taxa || "FIXA").toUpperCase();
    const rentAnual = Number(deb.rentabilidade_anual || 0);
    const valor = Number(venda.valor || 0);
    const dataVendaIso = venda.data_venda as string;

    // 2. Determina início do período: última retirada (do tipo rendimento) ou data da venda
    const { data: ultima } = await supabase
      .from("retiradas_debenture")
      .select("data_retirada")
      .eq("venda_id", venda_id)
      .eq("tipo", "rendimento")
      .order("data_retirada", { ascending: false })
      .limit(1)
      .maybeSingle();

    const inicioExclusivoIso = ultima?.data_retirada
      ? (ultima.data_retirada as string)
      : dataVendaIso;

    if (inicioExclusivoIso >= data_retirada) {
      return new Response(JSON.stringify({ error: "data_retirada deve ser posterior à última retirada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Verifica duplicidade
    const { data: dup } = await supabase
      .from("retiradas_debenture")
      .select("id")
      .eq("venda_id", venda_id)
      .eq("data_retirada", data_retirada)
      .eq("tipo", "rendimento")
      .maybeSingle();
    if (dup) {
      return new Response(JSON.stringify({ error: "Retirada já registrada nessa data" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Feriados + CDI
    const { data: feriadosRows } = await supabase.from("feriados").select("data");
    const feriados = new Set<string>((feriadosRows ?? []).map((r: any) => r.data as string));

    const cdi = new Map<string, number>();
    if (tipoTaxa === "CDI") {
      const inicioCdi = isoAdd(inicioExclusivoIso, -5);
      const { data: cdiRows } = await supabase
        .from("cdi_diario").select("data, taxa")
        .gte("data", inicioCdi).lte("data", data_retirada);
      for (const r of (cdiRows ?? []) as any[]) cdi.set(r.data, Number(r.taxa));
    }

    // 5. Calcula rendimento bruto
    const fator = calcularFator({
      tipoTaxa, rentAnual, inicioExclusivoIso,
      fimInclusivoIso: data_retirada, feriados, cdi,
    });
    const rendBruto = Number((valor * (fator - 1)).toFixed(2));
    if (rendBruto <= 0) {
      return new Response(JSON.stringify({ error: "Sem rendimento a pagar no período" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataVenda = new Date(dataVendaIso + "T00:00:00");
    const dataRet = new Date(data_retirada + "T00:00:00");
    const diasDesdeVenda = Math.floor((dataRet.getTime() - dataVenda.getTime()) / 86400000);
    const aliq = aliquotaIR(diasDesdeVenda);
    const ir = Number((rendBruto * (aliq / 100)).toFixed(2));
    const liquido = Number((rendBruto - ir).toFixed(2));

    // 6. Valida caixa e saldo
    const { data: caixa, error: errC } = await supabase
      .from("caixas").select("id, saldo, nome").eq("id", caixa_id).single();
    if (errC) throw errC;
    if (Number(caixa.saldo || 0) < liquido) {
      return new Response(JSON.stringify({
        error: `Saldo insuficiente no caixa ${caixa.nome}. Disponível: ${caixa.saldo}, necessário: ${liquido}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 7. Insere retirada
    const { data: retInserida, error: errIns } = await supabase
      .from("retiradas_debenture").insert({
        debenture_id: venda.debenture_id,
        debenturista_id: venda.debenturista_id,
        venda_id: venda.id,
        caixa_id,
        data_retirada,
        tipo: "rendimento",
        valor_retirado: liquido,
        rendimento_bruto: rendBruto,
        valor_ir_retido: ir,
        rendimento_liquido: liquido,
        observacoes: observacoes || null,
      }).select().single();
    if (errIns) throw errIns;

    // 8. Debita caixa
    const novoSaldo = Number((Number(caixa.saldo) - liquido).toFixed(2));
    const { error: errUp } = await supabase
      .from("caixas").update({ saldo: novoSaldo }).eq("id", caixa_id);
    if (errUp) throw errUp;

    return new Response(JSON.stringify({
      ok: true,
      retirada: retInserida,
      caixa_saldo_anterior: Number(caixa.saldo),
      caixa_saldo_novo: novoSaldo,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("efetivar-retirada-juros error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

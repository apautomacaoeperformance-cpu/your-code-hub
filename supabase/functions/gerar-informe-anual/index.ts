import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch {}

    const hoje = new Date();
    const ano = Number(body?.ano) || hoje.getFullYear() - 1;
    const inicio = `${ano}-01-01`;
    const fim = `${ano}-12-31`;

    const { data: rends, error } = await supabase
      .from("rendimentos_debenture")
      .select("debenturista_id, debenture_id, rendimento_bruto, valor_ir_retido, rendimento_liquido, venda_id")
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim);
    if (error) throw error;

    // saldo em 31/12: soma do valor das vendas até 31/12
    const { data: vendas, error: errV } = await supabase
      .from("vendas_debenture")
      .select("id, debenturista_id, debenture_id, valor, data_venda")
      .lte("data_venda", fim);
    if (errV) throw errV;

    type Key = string;
    const acc = new Map<Key, any>();
    for (const r of rends ?? []) {
      const k = `${r.debenturista_id}|${r.debenture_id ?? ""}`;
      const cur = acc.get(k) || {
        debenturista_id: r.debenturista_id,
        debenture_id: r.debenture_id,
        ano_calendario: ano,
        total_rendimento_bruto: 0,
        total_ir_retido: 0,
        total_rendimento_liquido: 0,
        saldo_em_31_12: 0,
      };
      cur.total_rendimento_bruto += Number(r.rendimento_bruto || 0);
      cur.total_ir_retido += Number(r.valor_ir_retido || 0);
      cur.total_rendimento_liquido += Number(r.rendimento_liquido || 0);
      acc.set(k, cur);
    }
    for (const v of vendas ?? []) {
      if (!v.debenturista_id) continue;
      const k = `${v.debenturista_id}|${v.debenture_id ?? ""}`;
      const cur = acc.get(k) || {
        debenturista_id: v.debenturista_id,
        debenture_id: v.debenture_id,
        ano_calendario: ano,
        total_rendimento_bruto: 0,
        total_ir_retido: 0,
        total_rendimento_liquido: 0,
        saldo_em_31_12: 0,
      };
      cur.saldo_em_31_12 += Number(v.valor || 0);
      acc.set(k, cur);
    }

    const rows = Array.from(acc.values()).map((r) => ({
      ...r,
      total_rendimento_bruto: Number(r.total_rendimento_bruto.toFixed(2)),
      total_ir_retido: Number(r.total_ir_retido.toFixed(2)),
      total_rendimento_liquido: Number(r.total_rendimento_liquido.toFixed(2)),
      saldo_em_31_12: Number(r.saldo_em_31_12.toFixed(2)),
      gerado_em: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, criados: 0, ano }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: errIns } = await supabase
      .from("informes_rendimento")
      .upsert(rows, { onConflict: "debenturista_id,debenture_id,ano_calendario" });
    if (errIns) throw errIns;

    return new Response(JSON.stringify({ ok: true, criados: rows.length, ano }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

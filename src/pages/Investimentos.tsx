import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, TrendingUp, Wallet, Percent, Search, X, ArrowUp, ArrowDown, ArrowUpDown, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";
import jhlLogo from "@/assets/jhl-logo.png";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useFeriados, diasUteis as diasUteisFn } from "@/lib/diasUteis";
import { calcRendimento, calcLiquido, calcIR, type CdiMap, type CalcOpts } from "@/lib/debentureCalc";
import { useAuth } from "@/hooks/useAuth";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

const fmtBRL = (n: number, locale: string) =>
  Number(n || 0).toLocaleString(locale, { style: "currency", currency: "BRL" });
const fmtPct = (n: number, locale: string, d = 2) =>
  `${Number(n || 0).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

const contratoOf = (v: any) => {
  const yr = (v.data_venda || v.created_at || "").slice(0, 4);
  const seq = String(v.id || "").replace(/-/g, "").slice(-4).toUpperCase();
  return `${yr}/${seq}`;
};

export default function Investimentos() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) => fmtBRL(n, locale);
  const fmtDate = (d?: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString(locale) : "-";

  const { user, roles } = useAuth();
  const isInvestidorOnly =
    roles.includes("investidor") &&
    !roles.some((r) => r === "admin" || r === "gestor" || r === "operador");

  const [tipo, setTipo] = useState<"PF" | "PJ">("PF");
  const [debenturistaId, setDebenturistaId] = useState<string>("__all__");

  const { data: feriados } = useFeriados();
  const diasUteis = (from: string, to: Date = new Date()) =>
    diasUteisFn(from, to, feriados);

  // Investor self-lookup by email (when role = investidor only)
  const { data: selfDebenturista } = useQuery({
    queryKey: ["self-debenturista", user?.email],
    enabled: isInvestidorOnly && !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debenturistas")
        .select("id,nome,tipo")
        .eq("email", user!.email!)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isInvestidorOnly && selfDebenturista) {
      setTipo((selfDebenturista.tipo as "PF" | "PJ") ?? "PF");
      setDebenturistaId(selfDebenturista.id);
    }
  }, [isInvestidorOnly, selfDebenturista]);

  // Debenturistas (Investidores) for the filter (staff only)
  const { data: debenturistas = [] } = useQuery({
    queryKey: ["debenturistas-inv", tipo],
    enabled: !isInvestidorOnly,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debenturistas")
        .select("id,nome,tipo")
        .eq("tipo", tipo)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (isInvestidorOnly) return;
    if (debenturistas.length && debenturistaId !== "__all__" && !debenturistas.find((d: any) => d.id === debenturistaId)) {
      setDebenturistaId("__all__");
    }
    if (!debenturistas.length) setDebenturistaId("__all__");
  }, [debenturistas, isInvestidorOnly]); // eslint-disable-line

  // Vendas of the selected investor (or all when "__all__")
  const isAll = debenturistaId === "__all__";
  const allIds = useMemo(() => debenturistas.map((d: any) => d.id), [debenturistas]);
  const { data: vendas = [] } = useQuery({
    queryKey: ["inv-vendas", debenturistaId, isAll ? allIds.join(",") : ""],
    enabled: !!debenturistaId && (!isAll || allIds.length > 0),
    queryFn: async () => {
      let query = supabase
        .from("vendas_debenture")
        .select(
          "id,data_venda,valor,created_at,debenture_id,cota:cota_id(numero),debenture:debenture_id(id,nome,serie,rentabilidade_anual,tipo_taxa,tipo_retirada,data_vencimento,data_inicio,emissao)"
        );
      query = isAll
        ? query.in("debenturista_id", allIds)
        : query.eq("debenturista_id", debenturistaId);
      const { data, error } = await query.order("data_venda", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Retiradas
  const { data: retiradas = [] } = useQuery({
    queryKey: ["inv-retiradas", debenturistaId, isAll ? allIds.join(",") : ""],
    enabled: !!debenturistaId && (!isAll || allIds.length > 0),
    queryFn: async () => {
      let query = supabase
        .from("retiradas_debenture")
        .select(
          "id,data_retirada,valor_retirado,rendimento_bruto,rendimento_liquido,valor_ir_retido,tipo,debenture:debenture_id(nome,rentabilidade_anual,tipo_taxa)"
        );
      query = isAll
        ? query.in("debenturista_id", allIds)
        : query.eq("debenturista_id", debenturistaId);
      const { data, error } = await query.order("data_retirada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });


  // CDI series (only if needed)
  const hasCDI = useMemo(
    () => vendas.some((v: any) => v.debenture?.tipo_taxa === "CDI"),
    [vendas]
  );
  const { data: cdiRows = [] } = useQuery({
    queryKey: ["inv-cdi"],
    enabled: hasCDI,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdi_diario")
        .select("data,taxa")
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const cdiMap = useMemo<CdiMap>(() => {
    const m = new Map<string, number>();
    cdiRows.forEach((r: any) => m.set(r.data, Number(r.taxa)));
    return m;
  }, [cdiRows]);

  // ---------- Group vendas by debenture+data_venda (one contract row) ----------
  type Row = {
    key: string;
    contrato: string;
    data_venda: string;
    data_vencimento: string;
    debenture: any;
    valor: number;
    cotas: string[];
    rendBruto: number;
    rendLiquido: number;
    ir: number;
    saldo: number;
  };

  const baseRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    vendas.forEach((v: any) => {
      const dv = v.data_venda || v.created_at?.slice(0, 10);
      const key = `${v.debenture_id}|${dv}`;
      const ex = map.get(key);
      const valor = Number(v.valor || 0);
      if (ex) {
        ex.valor += valor;
        if (v.cota?.numero != null) ex.cotas.push(v.cota.numero);
      } else {
        map.set(key, {
          key,
          contrato: contratoOf(v),
          data_venda: dv,
          data_vencimento: v.debenture?.data_vencimento,
          debenture: v.debenture,
          valor,
          cotas: v.cota?.numero != null ? [v.cota.numero] : [],
          rendBruto: 0,
          rendLiquido: 0,
          ir: 0,
          saldo: valor,
        });
      }
    });
    const arr = Array.from(map.values());
    arr.forEach((r) => {
      const rent = Number(r.debenture?.rentabilidade_anual ?? 0);
      const opts: CalcOpts = {
        tipoTaxa: r.debenture?.tipo_taxa,
        cdi: cdiMap,
        feriados,
        dataVenda: r.data_venda,
      };
      const du = diasUteis(r.data_venda);
      const bruto = calcRendimento(r.valor, rent, du, opts);
      r.rendBruto = bruto;
      r.ir = calcIR(bruto, r.data_venda);
      r.rendLiquido = bruto - r.ir;
      r.saldo = r.valor; // saldo investido = principal aplicado
    });
    return arr;
  }, [vendas, cdiMap, feriados]);

  const finalRows = useMemo(
    () => baseRows.filter((r) => (r.debenture?.tipo_retirada ?? "final") === "final"),
    [baseRows]
  );
  const preFixaRows = useMemo(
    () => finalRows.filter((r) => (r.debenture?.tipo_taxa || "FIXA") !== "CDI"),
    [finalRows]
  );
  const preCdiRows = useMemo(
    () => finalRows.filter((r) => (r.debenture?.tipo_taxa || "FIXA") === "CDI"),
    [finalRows]
  );
  const preRows = finalRows;
  const periodRows = useMemo(
    () => baseRows.filter((r) => (r.debenture?.tipo_retirada ?? "final") !== "final"),
    [baseRows]
  );

  const preFixaFiltered = preFixaRows;
  const preCdiFiltered = preCdiRows;
  const perFiltered = periodRows;

  // ---------- KPIs ----------
  const kpiFor = (rows: Row[]) => {
    const total = rows.reduce((s, r) => s + r.valor, 0);
    const rend = rows.reduce((s, r) => s + r.rendBruto, 0);
    const pct = total > 0 ? (rend / total) * 100 : 0;
    return { total, rend, pct };
  };
  const kpiFixa = useMemo(() => kpiFor(preFixaRows), [preFixaRows]);
  const kpiCdi = useMemo(() => kpiFor(preCdiRows), [preCdiRows]);

  const kpiPer = useMemo(() => {
    const total = periodRows.reduce((s, r) => s + r.valor, 0);
    const rend = periodRows.reduce((s, r) => s + r.rendLiquido, 0);
    return { total, rend };
  }, [periodRows]);

  // ---------- Chart data (Pré Fixado) ----------
  const chartData = useMemo(() => {
    if (preRows.length === 0) return [];
    const minStart = preRows.reduce(
      (m, r) => (r.data_venda < m ? r.data_venda : m),
      preRows[0].data_venda
    );
    const maxEnd = preRows.reduce(
      (m, r) => (r.data_vencimento > m ? r.data_vencimento : m),
      preRows[0].data_vencimento
    );
    const start = new Date(minStart + "T00:00:00");
    const end = new Date(maxEnd + "T00:00:00");
    const today = new Date();
    const points: any[] = [];
    // monthly steps
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      let rendFixa = 0;
      let rendCdi = 0;
      let principalFixa = 0;
      let principalCdi = 0;
      const future = cur > today;
      preRows.forEach((r) => {
        if (iso < r.data_venda) return;
        const rent = Number(r.debenture?.rentabilidade_anual ?? 0);
        const opts: CalcOpts = {
          tipoTaxa: r.debenture?.tipo_taxa,
          cdi: cdiMap,
          feriados,
          dataVenda: r.data_venda,
          ate: cur,
        };
        const du = diasUteisFn(r.data_venda, cur, feriados);
        const bruto = calcRendimento(r.valor, rent, du, opts);
        if ((r.debenture?.tipo_taxa || "FIXA") === "CDI") {
          rendCdi += bruto;
          principalCdi += Number(r.valor) || 0;
        } else {
          rendFixa += bruto;
          principalFixa += Number(r.valor) || 0;
        }
      });
      points.push({
        date: cur.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" }),
        preFixado: Number((principalFixa + rendFixa).toFixed(2)),
        cdi: Number((principalCdi + rendCdi).toFixed(2)),
        future,
        iso,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return points;
  }, [preRows, cdiMap, feriados, locale]);

  const todayIdx = useMemo(
    () => chartData.findIndex((p: any) => p.future),
    [chartData]
  );

  // ---------- Modalidade pretty ----------
  const modalidade = (r: Row) => {
    const rent = Number(r.debenture?.rentabilidade_anual ?? 0);
    const tx = r.debenture?.tipo_taxa || "FIXA";
    return `${rent.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ${tx}`;
  };

  // ---------- Relatório PDF ----------
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const gerarRelatorio = async () => {
    setGerandoPDF(true);
    try {
      const doc = new jsPDF({ orientation: "landscape" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Cabeçalho
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, 28, "F");
      try {
        doc.addImage(jhlLogo, "PNG", pageW - 14 - 16, 6, 16, 16);
      } catch (e) {
        console.warn("Falha ao inserir logo no PDF", e);
      }
      doc.setTextColor(25, 45, 77);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("AUREA SECURITIZADORA", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(t("pages.investimentos"), 14, 19);

      // Aviso (dados do dia anterior) — caixa marrom, igual a da tela
      const noticeY = 24;
      const noticeH = 9;
      doc.setFillColor(241, 231, 217);
      doc.setDrawColor(216, 196, 166);
      doc.roundedRect(14, noticeY, pageW - 28, noticeH, 2, 2, "FD");
      doc.setDrawColor(91, 58, 31);
      doc.circle(20, noticeY + noticeH / 2, 1.8, "S");
      doc.setTextColor(91, 58, 31);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("i", 20, noticeY + noticeH / 2 + 1.2, { align: "center" });
      doc.setFontSize(9);
      doc.text(t("investimentos.previousDayNotice"), 26, noticeY + noticeH / 2 + 1.2);

      // Investidor / tipo
      const investorName = isInvestidorOnly
        ? (selfDebenturista?.nome ?? user?.email ?? "-")
        : debenturistaId === "__all__"
          ? t("investimentos.all")
          : (debenturistas.find((d: any) => d.id === debenturistaId)?.nome ?? "-");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const invText = `${t("investimentos.investor")}: ${investorName}`;
      const invY = noticeY + noticeH + 7;
      doc.text(invText, 14, invY);
      const invW = doc.getTextWidth(invText);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(14, invY + 1.6, 14 + invW, invY + 1.6);

      let y = noticeY + noticeH + 15;
      const ensure = (need: number) => {
        if (y + need > pageH - 14) { doc.addPage(); y = 16; }
      };

      const headPre = [
        t("investimentos.colContractDate"), t("investimentos.colContract"), t("investimentos.colDueDate"),
        t("investimentos.colModality"), t("investimentos.colQuotas"), t("investimentos.colInvestment"),
        t("investimentos.colBalance"), t("investimentos.colYield"), t("investimentos.colIr"), t("investimentos.colReturn"),
      ];
      const headPer = [
        t("investimentos.colContractDate"), t("investimentos.colContract"), t("investimentos.colDueDate"),
        t("investimentos.colModality"), t("investimentos.colQuotas"), t("investimentos.colInvestment"),
        t("investimentos.colBalance"), t("investimentos.colMonthlyYield"), t("investimentos.colIr"),
      ];
      const rowPre = (r: any) => [
        fmtDate(r.data_venda), r.contrato, fmtDate(r.data_vencimento), modalidade(r),
        String(r.cotas.length), fmt(r.valor), fmt(r.saldo), fmt(r.rendBruto), fmt(r.ir), fmt(r.valor + r.rendLiquido),
      ];
      const rowPer = (r: any) => [
        fmtDate(r.data_venda), r.contrato, fmtDate(r.data_vencimento), modalidade(r),
        String(r.cotas.length), fmt(r.valor), fmt(r.saldo), fmt(r.rendBruto), fmt(r.ir),
      ];

      const section = (title: string, kpiLine: string, head: string[], body: any[][], moneyCols: number[], foot?: any[]) => {
        ensure(24);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, y);
        y += 6;
        if (kpiLine) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80);
          doc.text(kpiLine, 14, y);
          y += 4;
        }
        autoTable(doc, {
          startY: y,
          head: [head],
          body: body.length
            ? body
            : [[{ content: t("investimentos.noRecords"), colSpan: head.length, styles: { halign: "center", textColor: 130 } }]],
          foot: foot ? [foot] : undefined,
          styles: { fontSize: 8, cellPadding: 2, halign: "center", valign: "middle" },
          headStyles: { fillColor: [25, 45, 77], textColor: 255, halign: "center" },
          footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold", halign: "center" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      };

      // Totais (somatório das colunas) — inclui a coluna Retorno
      const footPre = (rows: any[]): any[] => {
        const sv = rows.reduce((s, r) => s + r.valor, 0);
        const ss = rows.reduce((s, r) => s + r.saldo, 0);
        const sb = rows.reduce((s, r) => s + r.rendBruto, 0);
        const si = rows.reduce((s, r) => s + r.ir, 0);
        const sr = rows.reduce((s, r) => s + r.valor + r.rendLiquido, 0);
        return [
          { content: "Total", colSpan: 5, styles: { halign: "center" as const } },
          fmt(sv), fmt(ss), fmt(sb), fmt(si), fmt(sr),
        ];
      };

      // Pré Fixado
      section(
        t("investimentos.titlePre"),
        `${t("investimentos.totalInvestedPre")}: ${fmt(kpiFixa.total)}   |   ${t("investimentos.yieldPct")}: ${fmtPct(kpiFixa.pct, locale, 3)}   |   ${t("investimentos.yieldLabel")}: ${fmt(kpiFixa.total + kpiFixa.rend)}`,
        headPre, preFixaFiltered.map(rowPre), [5, 6, 7, 8, 9], footPre(preFixaFiltered),
      );
      // CDI
      section(
        t("investimentos.titleCdi"),
        `${t("investimentos.totalInvestedCdi")}: ${fmt(kpiCdi.total)}   |   ${t("investimentos.yieldPct")}: ${fmtPct(kpiCdi.pct, locale, 3)}   |   ${t("investimentos.yieldLabel")}: ${fmt(kpiCdi.total + kpiCdi.rend)}`,
        headPre, preCdiFiltered.map(rowPre), [5, 6, 7, 8, 9], footPre(preCdiFiltered),
      );
      // Periódicos / Semestrais
      section(
        t("investimentos.titlePer"),
        `${t("investimentos.totalInvestedPre")}: ${fmt(kpiPer.total)}   |   ${t("investimentos.yieldLabel")}: ${fmt(kpiPer.total + kpiPer.rend)}`,
        headPer, perFiltered.map(rowPer), [5, 6, 7, 8],
      );
      // Retiradas
      const headRet = [
        t("investimentos.paymentDate"), t("investimentos.value"), t("investimentos.debenture"),
        t("investimentos.modality"), t("investimentos.typeCol"),
      ];
      const rowsRet = (retiradas as any[]).map((r: any) => [
        fmtDate(r.data_retirada),
        fmt(r.valor_retirado),
        r.debenture?.nome ?? "-",
        r.debenture
          ? `${Number(r.debenture.rentabilidade_anual ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ${r.debenture.tipo_taxa || "FIXA"}`
          : "-",
        r.tipo || "-",
      ]);
      section(t("investimentos.withdrawals"), "", headRet, rowsRet, [1]);

      // Rodapé
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, pageH - 8);
        doc.text(`Página ${i} de ${pages}`, pageW - 14, pageH - 8, { align: "right" });
      }

      previewPdf(doc, `investimentos_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(t("debentures.reportGenerated"));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar relatório");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="space-y-3 -mt-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pages.investimentos")}</h1>
        <Button variant="outline" className="gap-2" onClick={gerarRelatorio} disabled={gerandoPDF}>
          <FileText className="h-4 w-4" />
          {gerandoPDF ? t("debentures.generating") : t("debentures.reportPdf")}
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-[#d8c4a6] bg-[#f1e7d9] px-4 py-2.5 text-sm font-medium text-[#5b3a1f] dark:border-[#5b3a1f]/40 dark:bg-[#3a2616]/40 dark:text-[#e3cba9]">
        <Info className="h-4 w-4 shrink-0" />
        <span>{t("investimentos.previousDayNotice")}</span>
      </div>

      {/* Filters */}
      {isInvestidorOnly ? (
        <Card className="max-w-xl">
          <CardContent className="p-2">
            <div className="space-y-0.5">
              <Label className="text-xs">{t("investimentos.investor")}</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-1 text-sm font-medium">
                {selfDebenturista?.nome ?? user?.email ?? "-"}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-2 p-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("investimentos.type")}</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "PF" | "PJ")}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">{t("investimentos.pf")}</SelectItem>
                  <SelectItem value="PJ">{t("investimentos.pj")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("investimentos.investor")}</Label>
              <Select value={debenturistaId} onValueChange={setDebenturistaId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder={debenturistas.length ? t("investimentos.selectInvestor") : t("investimentos.noInvestor")} />
                </SelectTrigger>
                <SelectContent>
                  {debenturistas.length > 0 && (
                    <SelectItem value="__all__">{t("investimentos.all")}</SelectItem>
                  )}
                  {debenturistas.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </CardContent>
        </Card>
      )}

      {/* KPIs Pré Fixado */}
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label={t("investimentos.totalInvestedPre")} value={fmt(kpiFixa.total)} icon={Wallet} accentColor="hsl(142 71% 45%)" bgColor="hsl(142 71% 95%)" />
        <Kpi label={t("investimentos.yieldPct")} value={fmtPct(kpiFixa.pct, locale, 3)} icon={Percent} accentColor="hsl(142 71% 45%)" bgColor="hsl(142 71% 95%)" />
        <Kpi label={t("investimentos.yieldLabel")} value={fmt(kpiFixa.rend)} icon={TrendingUp} accentColor="hsl(142 71% 45%)" bgColor="hsl(142 71% 95%)" />
      </div>

      {/* Tabela Pré Fixado */}
      <SectionCard
        title={t("investimentos.titlePre")}
      >
        <DataTable
          rows={preFixaFiltered}
          locale={locale}
          fmt={fmt}
          fmtDate={fmtDate}
          modalidade={modalidade}
          variant="pre"

        />
      </SectionCard>

      {/* KPIs CDI */}
      <div className="grid gap-4 md:grid-cols-3 !mt-8">
        <Kpi label={t("investimentos.totalInvestedCdi")} value={fmt(kpiCdi.total)} icon={Wallet} accentColor="hsl(217 51% 20%)" bgColor="hsl(217 51% 95%)" />
        <Kpi label={t("investimentos.yieldPct")} value={fmtPct(kpiCdi.pct, locale, 3)} icon={Percent} accentColor="hsl(217 51% 20%)" bgColor="hsl(217 51% 95%)" />
        <Kpi label={t("investimentos.yieldLabel")} value={fmt(kpiCdi.rend)} icon={TrendingUp} accentColor="hsl(217 51% 20%)" bgColor="hsl(217 51% 95%)" />
      </div>

      {/* Tabela CDI */}
      <SectionCard
        title={t("investimentos.titleCdi")}
      >
        <DataTable
          rows={preCdiFiltered}
          locale={locale}
          fmt={fmt}
          fmtDate={fmtDate}
          modalidade={modalidade}
          variant="pre"

        />
      </SectionCard>

      {/* Chart */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base font-semibold">{t("investimentos.chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-2 pt-0">
          {chartData.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("investimentos.noData")}
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} width={90} />
                  <RTooltip
                    formatter={(v: any, name: string) => [fmt(Number(v)), name]}
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} height={24} />
                  {todayIdx > 0 && (
                    <ReferenceLine
                      x={chartData[todayIdx]?.date}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3"
                      label={{ value: t("investimentos.today"), fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    />
                  )}
                  <Line type="monotone" dataKey="preFixado" name={t("investimentos.linePre")} stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cdi" name={t("investimentos.lineCdi")} stroke="hsl(217 51% 20%)" strokeWidth={2} dot={false} />

                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Tabela Periódicos */}
      <SectionCard
        title={t("investimentos.titlePer")}
      >
        <DataTable
          rows={perFiltered}
          locale={locale}
          fmt={fmt}
          fmtDate={fmtDate}
          modalidade={modalidade}
          variant="per"

        />
      </SectionCard>

      {/* Retiradas */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base font-semibold">{t("investimentos.withdrawals")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/40 text-[10px] tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-2 text-left font-medium">{t("investimentos.paymentDate")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("investimentos.value")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("investimentos.debenture")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("investimentos.modality")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("investimentos.typeCol")}</th>
              </tr>
            </thead>
            <tbody>
              {retiradas.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-6 py-2 text-muted-foreground">{fmtDate(r.data_retirada)}</td>
                  <td className="px-6 py-2 font-medium text-foreground">{fmt(r.valor_retirado)}</td>
                  <td className="px-6 py-2 text-muted-foreground">{r.debenture?.nome ?? "-"}</td>
                  <td className="px-6 py-2 text-muted-foreground">
                    {r.debenture
                      ? `${Number(r.debenture.rentabilidade_anual ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ${r.debenture.tipo_taxa || "FIXA"}`
                      : "-"}
                  </td>
                  <td className="px-6 py-2">
                    <Badge variant="outline" className="capitalize">{r.tipo || "-"}</Badge>
                  </td>
                </tr>
              ))}
              {retiradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    {t("investimentos.noWithdrawals")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accentColor, bgColor }: { label: string; value: string; icon: any; accentColor?: string; bgColor?: string }) {
  const hasBg = !!bgColor;
  return (
    <Card className={accentColor ? "border-l-4 border-r-4" : ""} style={{ ...(accentColor ? { borderLeftColor: accentColor, borderRightColor: accentColor } : {}), ...(bgColor ? { backgroundColor: bgColor, color: "hsl(217 47% 11%)" } : {}) }}>
      <CardContent className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="space-y-1">
          <div className={`text-xs font-medium ${hasBg ? "text-slate-600" : "text-muted-foreground"}`}>{label}</div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  children,
  headerStyle,
}: {
  title: string;
  children: React.ReactNode;
  headerStyle?: React.CSSProperties;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 py-3" style={headerStyle}>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

function DataTable({
  rows,
  locale,
  fmt,
  fmtDate,
  modalidade,
  variant,
}: {
  rows: any[];
  locale: string;
  fmt: (n: number) => string;
  fmtDate: (d?: string | null) => string;
  modalidade: (r: any) => string;
  variant: "pre" | "per";
}) {
  const { t: tt } = useTranslation();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getVal = (r: any, key: string) => {
    switch (key) {
      case "data_venda": return r.data_venda ? new Date(r.data_venda).getTime() : 0;
      case "contrato": return String(r.contrato ?? "").toLowerCase();
      case "data_vencimento": return r.data_vencimento ? new Date(r.data_vencimento).getTime() : 0;
      case "modalidade": return modalidade(r).toLowerCase();
      case "cotas": return r.cotas.length;
      case "valor": return r.valor;
      case "saldo": return r.saldo;
      case "rendBruto": return r.rendBruto;
      case "ir": return r.ir;
      case "retorno": return r.valor + r.rendLiquido;
      default: return 0;
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = getVal(a, sortKey);
      const vb = getVal(b, sortKey);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir, modalidade]);

  const SortableTh = ({ k, label }: { k: string; label: string }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className="px-4 py-3 text-left font-medium">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
        >
          <span>{label}</span>
          <Icon className="h-3 w-3 opacity-70" />
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <SortableTh k="data_venda" label={tt("investimentos.colContractDate")} />
            <SortableTh k="contrato" label={tt("investimentos.colContract")} />
            <SortableTh k="data_vencimento" label={tt("investimentos.colDueDate")} />
            <SortableTh k="modalidade" label={tt("investimentos.colModality")} />
            <SortableTh k="cotas" label={tt("investimentos.colQuotas")} />
            <SortableTh k="valor" label={tt("investimentos.colInvestment")} />
            <SortableTh k="saldo" label={tt("investimentos.colBalance")} />
            <SortableTh k={variant === "pre" ? "rendBruto" : "rendBruto"} label={variant === "pre" ? tt("investimentos.colYield") : tt("investimentos.colMonthlyYield")} />
            <SortableTh k="ir" label={tt("investimentos.colIr")} />
            {variant === "pre" && <SortableTh k="retorno" label={tt("investimentos.colReturn")} />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.key} className="border-b border-border/60 hover:bg-muted/30">
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.data_venda)}</td>
              <td className="px-4 py-3 font-medium text-foreground">{r.contrato}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.data_vencimento)}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-foreground">{modalidade(r)}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{r.cotas.length}</td>
              <td className="px-4 py-3 text-foreground">{fmt(r.valor)}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmt(r.saldo)}</td>
              <td className="px-4 py-3 font-medium text-success">{fmt(r.rendBruto)}</td>
              <td className="px-4 py-3 text-destructive">{fmt(r.ir)}</td>
              {variant === "pre" && (
                <td className="px-4 py-3 font-semibold text-success">{fmt(r.valor + r.rendLiquido)}</td>
              )}
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={variant === "pre" ? 10 : 9} className="py-10 text-center text-sm text-muted-foreground">
                {tt("investimentos.noRecords")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

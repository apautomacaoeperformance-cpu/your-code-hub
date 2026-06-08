import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { HelpCircle, Download, RotateCcw, Trophy, TrendingUp, Lightbulb, Calculator } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Switch } from "@/components/ui/switch";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { simular, simularCenarios, type SimInput } from "@/lib/simulador/calculations";
import { formatBRL, formatPct, maskCurrency, unmaskCurrency } from "@/lib/simulador/formatters";
import { previewPdf } from "@/lib/pdfPreview";
import jhlLogo from "@/assets/jhl-logo.png";

const DEFAULTS: SimInput = {
  valorInicial: 1000,
  aporteMensal: 0,
  prazoMeses: 24,
  cdiAnual: 14.40,
  percentualCDI: 100,
  taxaPrefixadaAnual: 13,
};

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground hover:text-foreground" tabIndex={-1}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

function NumField({
  id, label, value, onChange, suffix, hint, min, step,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  suffix?: string; hint?: string; min?: number; step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        {hint && <InfoTip text={hint} />}
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          step={step ?? "any"}
          onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
          className={suffix ? "pr-12" : ""}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function CurrencyField({
  id, label, value, onChange, hint, step = 1000, min = 0,
}: {
  id: string; label: string; value: number; onChange: (v: number) => void;
  hint?: string; step?: number; min?: number;
}) {
  const [str, setStr] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setStr(maskCurrency(Math.round(value * 100).toString()));
    }
  }, [value, focused]);

  const commit = (raw: number) => {
    const rounded = Math.max(min, Math.round(raw / step) * step);
    onChange(rounded);
    setStr(maskCurrency(String(rounded * 100)));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCurrency(e.target.value);
    setStr(masked);
    const raw = unmaskCurrency(masked);
    onChange(Math.max(min, raw));
  };

  const bump = (dir: 1 | -1) => {
    commit((value || 0) + dir * step);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); bump(1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); bump(-1); }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        {hint && <InfoTip text={hint} />}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          R$
        </span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={str}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commit(value || 0); }}
          onKeyDown={onKeyDown}
          className="pl-9 pr-7"
          placeholder="0,00"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => bump(1)}
            className="h-3 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Aumentar"
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 0L8 6H0L4 0Z" fill="currentColor"/></svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => bump(-1)}
            className="h-3 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Diminuir"
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M4 6L0 0H8L4 6Z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calculadora() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || "pt";
  const [input, setInput] = useState<SimInput>(DEFAULTS);
  const [mostrarPoupanca, setMostrarPoupanca] = useState(false);

  const result = useMemo(() => simular(input), [input]);
  const cenarios = useMemo(() => simularCenarios(input), [input]);

  const vencedor: "cdi" | "prefixado" =
    result.cdi.montanteLiquido >= result.prefixado.montanteLiquido ? "cdi" : "prefixado";
  const diferenca = Math.abs(result.cdi.montanteLiquido - result.prefixado.montanteLiquido);

  const set = <K extends keyof SimInput>(k: K, v: SimInput[K]) =>
    setInput((prev) => ({ ...prev, [k]: v }));

  const limpar = () => setInput(DEFAULTS);

  const construirPDF = (): jsPDF => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    void localeMap; void lang;
    const aaSuffix = t("simulador.pdf.aa");
    const mesesSuffix = t("simulador.pdf.mesesSuffix");

    // Cabeçalho
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 26, "F");
    try {
      // Logo AUREA (monograma quadrado)
      doc.addImage(jhlLogo, "PNG", pageW - margin - 16, 6, 16, 16);
    } catch (e) {
      console.warn("Falha ao inserir logo no PDF", e);
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(t("simulador.title"), margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(t("simulador.pdf.subtitle"), margin, 19);

    doc.setTextColor(20, 20, 20);
    let y = 30;

    // Parâmetros
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.params"), margin, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      head: [[t("simulador.pdf.campo"), t("simulador.pdf.valor")]],
      body: [
        [t("simulador.fields.valorInicial"), formatBRL(input.valorInicial)],
        [t("simulador.fields.aporteMensal"), formatBRL(input.aporteMensal)],
        [t("simulador.fields.prazo"), `${input.prazoMeses}${mesesSuffix}`],
        [t("simulador.fields.cdiAnual"), `${formatPct(input.cdiAnual)}${aaSuffix}`],
        [t("simulador.fields.percentualCDI"), `${formatPct(input.percentualCDI)}`],
        [t("simulador.fields.taxaPrefixada"), `${formatPct(input.taxaPrefixadaAnual)}${aaSuffix}`],
        [t("simulador.pdf.irLabel"), t("simulador.pdf.irApplied")],
      ],
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Resultados comparativos
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.pdf.resultsTitle"), margin, y);
    autoTable(doc, {
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      head: [[t("simulador.pdf.indicador"), t("simulador.result.cdi"), t("simulador.result.prefixado")]],
      body: [
        [t("simulador.result.montanteLiquido"), formatBRL(result.cdi.montanteLiquido), formatBRL(result.prefixado.montanteLiquido)],
        [t("simulador.result.totalInvestido"), formatBRL(result.cdi.totalInvestido), formatBRL(result.prefixado.totalInvestido)],
        [t("simulador.result.rendLiquido"), formatBRL(result.cdi.montanteLiquido - result.cdi.totalInvestido), formatBRL(result.prefixado.montanteLiquido - result.prefixado.totalInvestido)],
        [t("simulador.result.rentPeriodo"), formatPct(result.cdi.rentLiquidaTotalPct), formatPct(result.prefixado.rentLiquidaTotalPct)],
        [t("simulador.result.equivAnual"), formatPct(result.cdi.rentLiquidaAaPct), formatPct(result.prefixado.rentLiquidaAaPct)],
        [t("simulador.result.irDesc"), formatBRL(result.cdi.ir), formatBRL(result.prefixado.ir)],
      ],
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Destaque vencedor
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, "FD");
    doc.setTextColor(6, 95, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(t("simulador.pdf.melhorHoje", { op: vencedor === "cdi" ? t("simulador.result.cdi") : t("simulador.result.prefixado") }), margin + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(t("simulador.analise.rendMais", { valor: formatBRL(diferenca) }), margin + 3, y + 11);
    doc.setTextColor(20, 20, 20);
    y += 18;

    // Break-even
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.pdf.breakEvenTitle"), margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (result.breakEvenCdiAnual !== null) {
      doc.text(t("simulador.pdf.breakEvenLine", { taxa: formatPct(result.breakEvenCdiAnual) }), margin, y);
    } else {
      doc.text(t("simulador.analise.semBreakEven"), margin, y);
    }
    y += 6;

    // Cenários
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.pdf.cenariosTitle"), margin, y);
    const cdiLabel = t("simulador.chart.cdi");
    const prefLabel = t("simulador.chart.prefixado");
    const cenariosRows = [
      { nome: t("simulador.cenarios.cai"), r: cenarios.cai, cdi: Math.max(0, input.cdiAnual - 2) },
      { nome: t("simulador.cenarios.estavel"), r: cenarios.estavel, cdi: input.cdiAnual },
      { nome: t("simulador.cenarios.sobe"), r: cenarios.sobe, cdi: input.cdiAnual + 2 },
    ].map((c) => {
      const venc = c.r.cdi.montanteLiquido >= c.r.prefixado.montanteLiquido ? cdiLabel : prefLabel;
      return [
        c.nome,
        `${formatPct(c.cdi)}${aaSuffix}`,
        formatBRL(c.r.cdi.montanteLiquido),
        formatBRL(c.r.prefixado.montanteLiquido),
        venc,
      ];
    });
    autoTable(doc, {
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      head: [[
        t("simulador.cenarios.colCenario"),
        t("simulador.cenarios.colCdiAa"),
        t("simulador.cenarios.colCdiLiq"),
        t("simulador.cenarios.colPrefLiq"),
        t("simulador.cenarios.colVencedor"),
      ]],
      body: cenariosRows,
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Evolução do saldo
    const serie = result.serie;
    const marcos = new Set<number>();
    const total = serie.length - 1;
    [0, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total].forEach((m) => marcos.add(m));
    const serieRows = Array.from(marcos)
      .sort((a, b) => a - b)
      .map((m) => {
        const p = serie[m];
        return [String(p.mes), formatBRL(p.totalInvestido), formatBRL(p.cdi), formatBRL(p.prefixado)];
      });
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.pdf.evolucaoTitle"), margin, y);
    autoTable(doc, {
      startY: y + 2,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      head: [[t("simulador.pdf.colMes"), t("simulador.result.totalInvestido"), cdiLabel, prefLabel]],
      body: serieRows,
      margin: { left: margin, right: margin },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 6;

    // Recomendação
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t("simulador.pdf.recomendacaoTitle"), margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const be = result.breakEvenCdiAnual;
    let rec = t("simulador.analise.recInconc");
    if (be !== null) {
      rec = be > input.cdiAnual
        ? t("simulador.analise.recPrefMelhor", { taxa: formatPct(be) })
        : t("simulador.analise.recCdiMelhor", { taxa: formatPct(be) });
    }
    const lines = doc.splitTextToSize(rec, pageW - margin * 2);
    doc.text(lines, margin, y);

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(t("simulador.pdf.footer"), margin, doc.internal.pageSize.getHeight() - 8);
      doc.text(
        t("simulador.pdf.pageOf", { i, n: pageCount }),
        pageW - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" },
      );
    }

    return doc;
  };

  const exportarPDF = () => {
    try {
      const doc = construirPDF();
      const fileName = `simulador-cdi-vs-prefixado-${Date.now()}.pdf`;
      previewPdf(doc, fileName);
    } catch (e) {
      console.error(e);
      toast.error(t("simulador.pdfError"));
    }
  };

  const suffixMeses = t("simulador.suffix.meses");
  const suffixAa = t("simulador.suffix.aa");
  const suffixPct = t("simulador.suffix.pct");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Calculator className="h-6 w-6 text-primary" />
            {t("simulador.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("simulador.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={limpar}>
            <RotateCcw className="mr-2 h-4 w-4" /> {t("simulador.limpar")}
          </Button>
          <Button onClick={exportarPDF}>
            <Download className="mr-2 h-4 w-4" /> {t("simulador.exportarPdf")}
          </Button>
        </div>
      </div>

      <div className="space-y-6 bg-background">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("simulador.params")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <CurrencyField
                id="valorInicial" label={t("simulador.fields.valorInicial")}
                value={input.valorInicial} onChange={(v) => set("valorInicial", v)}
                hint={t("simulador.hints.valorInicial")}
              />
              <CurrencyField
                id="aporteMensal" label={t("simulador.fields.aporteMensal")}
                value={input.aporteMensal} onChange={(v) => set("aporteMensal", v)}
                hint={t("simulador.hints.aporteMensal")}
              />
              <NumField
                id="prazoMeses" label={t("simulador.fields.prazo")} suffix={suffixMeses} min={1}
                value={input.prazoMeses} onChange={(v) => set("prazoMeses", Math.max(1, Math.round(v)))}
                hint={t("simulador.hints.prazo")}
              />
              <NumField
                id="cdiAnual" label={t("simulador.fields.cdiAnual")} suffix={suffixAa} min={0}
                value={input.cdiAnual} onChange={(v) => set("cdiAnual", v)}
                hint={t("simulador.hints.cdiAnual")}
              />
              <NumField
                id="percentualCDI" label={t("simulador.fields.percentualCDI")} suffix={suffixPct} min={0}
                value={input.percentualCDI} onChange={(v) => set("percentualCDI", v)}
                hint={t("simulador.hints.percentualCDI")}
              />
              <NumField
                id="taxaPrefixadaAnual" label={t("simulador.fields.taxaPrefixada")} suffix={suffixAa} min={0}
                value={input.taxaPrefixadaAnual} onChange={(v) => set("taxaPrefixadaAnual", v)}
                hint={t("simulador.hints.taxaPrefixada")}
              />
              <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                <div className="space-y-0.5">
                  <Label className="text-sm">{t("simulador.poupanca.label")}</Label>
                  <p className="text-xs text-muted-foreground">{t("simulador.poupanca.desc")}</p>
                </div>
                <Switch checked={mostrarPoupanca} onCheckedChange={setMostrarPoupanca} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <ResultCard
              title={t("simulador.result.cdi")}
              accent="primary"
              winner={vencedor === "cdi"}
              winnerLabel={t("simulador.result.melhorOpcao")}
              labels={{
                montanteLiquido: t("simulador.result.montanteLiquido"),
                rendBruto: t("simulador.result.rendBruto"),
                rendLiquido: t("simulador.result.rendLiquido"),
                rentPeriodo: t("simulador.result.rentPeriodo"),
                equivAnual: t("simulador.result.equivAnual"),
                irDesc: t("simulador.result.irDesc"),
                totalInvestido: t("simulador.result.totalInvestido"),
              }}
              out={result.cdi}
            />
            <ResultCard
              title={t("simulador.result.prefixado")}
              accent="gold"
              winner={vencedor === "prefixado"}
              winnerLabel={t("simulador.result.melhorOpcao")}
              labels={{
                montanteLiquido: t("simulador.result.montanteLiquido"),
                rendBruto: t("simulador.result.rendBruto"),
                rendLiquido: t("simulador.result.rendLiquido"),
                rentPeriodo: t("simulador.result.rentPeriodo"),
                equivAnual: t("simulador.result.equivAnual"),
                irDesc: t("simulador.result.irDesc"),
                totalInvestido: t("simulador.result.totalInvestido"),
              }}
              out={result.prefixado}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("simulador.chart.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.serie} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} label={{ value: t("simulador.chart.mes"), position: "insideBottom", offset: -2, fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    formatter={(v: number) => formatBRL(v)}
                    labelFormatter={(l) => t("simulador.chart.tooltipMes", { n: l })}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={result.serie[result.serie.length - 1]?.totalInvestido}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: t("simulador.chart.totalInvestido"), position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Line type="monotone" dataKey="cdi" name={t("simulador.chart.cdi")} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="prefixado" name={t("simulador.chart.prefixado")} stroke="#D4AF37" strokeWidth={2.5} dot={false} />
                  {mostrarPoupanca && (
                    <Line type="monotone" dataKey="poupanca" name={t("simulador.poupanca.legend")} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-emerald-500" /> {t("simulador.analise.melhorOpcaoTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-lg font-semibold">{vencedor === "cdi" ? t("simulador.chart.cdi") : t("simulador.chart.prefixado")}</p>
              <p className="text-muted-foreground">{t("simulador.analise.rendMais", { valor: formatBRL(diferenca) })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" /> {t("simulador.analise.breakEvenTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {result.breakEvenCdiAnual !== null ? (
                <>
                  <p className="text-lg font-semibold">{formatPct(result.breakEvenCdiAnual)}{suffixAa.replace("%", "").trim() ? ` ${suffixAa.replace("%", "").trim()}` : ""}</p>
                  <p className="text-muted-foreground">{t("simulador.analise.breakEvenDesc")}</p>
                </>
              ) : (
                <p className="text-muted-foreground">{t("simulador.analise.semBreakEven")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 text-amber-500" /> {t("simulador.analise.recomendacaoTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {(() => {
                const be = result.breakEvenCdiAnual;
                if (be === null) return t("simulador.analise.recInconc");
                if (be > input.cdiAnual) return t("simulador.analise.recPrefMelhor", { taxa: formatPct(be) });
                return t("simulador.analise.recCdiMelhor", { taxa: formatPct(be) });
              })()}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("simulador.cenarios.title")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">{t("simulador.cenarios.colCenario")}</th>
                  <th className="py-2 font-medium">{t("simulador.cenarios.colCdiAa")}</th>
                  <th className="py-2 font-medium">{t("simulador.cenarios.colCdiLiq")}</th>
                  <th className="py-2 font-medium">{t("simulador.cenarios.colPrefLiq")}</th>
                  <th className="py-2 font-medium">{t("simulador.cenarios.colVencedor")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nome: t("simulador.cenarios.cai"), r: cenarios.cai, cdi: Math.max(0, input.cdiAnual - 2) },
                  { nome: t("simulador.cenarios.estavel"), r: cenarios.estavel, cdi: input.cdiAnual },
                  { nome: t("simulador.cenarios.sobe"), r: cenarios.sobe, cdi: input.cdiAnual + 2 },
                ].map((c) => {
                  const isCdi = c.r.cdi.montanteLiquido >= c.r.prefixado.montanteLiquido;
                  const venc = isCdi ? t("simulador.chart.cdi") : t("simulador.chart.prefixado");
                  return (
                    <tr key={c.nome} className="border-b last:border-0">
                      <td className="py-2">{c.nome}</td>
                      <td className="py-2">{formatPct(c.cdi)}</td>
                      <td className="py-2">{formatBRL(c.r.cdi.montanteLiquido)}</td>
                      <td className="py-2">{formatBRL(c.r.prefixado.montanteLiquido)}</td>
                      <td className="py-2">
                        <Badge variant={isCdi ? "default" : "secondary"}>{venc}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("simulador.educ.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="font-semibold">{t("simulador.educ.cdiTitle")}</p>
              <p className="text-muted-foreground">{t("simulador.educ.cdiText")}</p>
            </div>
            <div>
              <p className="font-semibold">{t("simulador.educ.prefTitle")}</p>
              <p className="text-muted-foreground">{t("simulador.educ.prefText")}</p>
            </div>
            <div>
              <p className="font-semibold">{t("simulador.educ.irTitle")}</p>
              <p className="text-muted-foreground">{t("simulador.educ.irText")}</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">{t("simulador.disclaimer")}</p>
      </div>
    </div>
  );
}

function ResultCard({
  title, accent, winner, winnerLabel, labels, out,
}: {
  title: string;
  accent: "primary" | "gold";
  winner: boolean;
  winnerLabel: string;
  labels: {
    montanteLiquido: string;
    rendBruto: string;
    rendLiquido: string;
    rentPeriodo: string;
    equivAnual: string;
    irDesc: string;
    totalInvestido: string;
  };
  out: ReturnType<typeof simular>["cdi"];
}) {
  const borderClass = accent === "primary" ? "border-primary/60" : "border-[#D4AF37]";
  return (
    <Card className={`relative border-2 ${borderClass}`}>
      {winner && (
        <Badge className="absolute right-3 top-3 bg-emerald-500 text-white hover:bg-emerald-500">
          {winnerLabel}
        </Badge>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-bold tracking-tight">{formatBRL(out.montanteLiquido)}</p>
        <p className="text-xs text-muted-foreground">{labels.montanteLiquido}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs">
          <div className="text-muted-foreground">{labels.rendBruto}</div>
          <div className="text-right font-medium">{formatBRL(out.rendimentoBruto)}</div>
          <div className="text-muted-foreground">{labels.irDesc}</div>
          <div className="text-right font-medium">- {formatBRL(out.ir)}</div>
          <div className="text-muted-foreground">{labels.rendLiquido}</div>
          <div className="text-right font-medium">{formatBRL(out.montanteLiquido - out.totalInvestido)}</div>
          <div className="text-muted-foreground">{labels.rentPeriodo}</div>
          <div className="text-right font-medium">{formatPct(out.rentLiquidaTotalPct)}</div>
          <div className="text-muted-foreground">{labels.equivAnual}</div>
          <div className="text-right font-medium">{formatPct(out.rentLiquidaAaPct)}</div>
          <div className="text-muted-foreground">{labels.totalInvestido}</div>
          <div className="text-right font-medium">{formatBRL(out.totalInvestido)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

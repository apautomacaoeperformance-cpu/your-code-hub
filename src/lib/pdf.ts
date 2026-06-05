import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";
import i18n from "@/i18n";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };
const currencyMap: Record<string, string> = { pt: "BRL", en: "USD", es: "EUR" };

const getLocale = () => localeMap[i18n.language] ?? "pt-BR";
const getCurrency = () => currencyMap[i18n.language] ?? "BRL";

const fmtMoney = (n: number) =>
  Number(n).toLocaleString(getLocale(), { style: "currency", currency: getCurrency() });

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(getLocale());

const t = (key: string, fallback?: string) => {
  const v = i18n.t(key);
  return v === key && fallback ? fallback : (v as string);
};

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("JHL SECURITIZADORA", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(t("pdf.brandTagline", "Plataforma de crédito"), 14, 19);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(subtitle, 14, 46);
    doc.setTextColor(0, 0, 0);
  }
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${t("pdf.generatedAt", "Gerado em")} ${new Date().toLocaleString(getLocale())}`,
      14,
      h - 8
    );
    doc.text(
      `${t("pdf.page", "Página")} ${i} ${t("pdf.of", "de")} ${pages}`,
      w - 14,
      h - 8,
      { align: "right" }
    );
  }
}

function buildSubtitle(filtros: { inicio?: string; fim?: string; status?: string }) {
  const partes: string[] = [];
  if (filtros.inicio) partes.push(`${t("pdf.from", "De")} ${fmtDate(filtros.inicio)}`);
  if (filtros.fim) partes.push(`${t("pdf.to", "até")} ${fmtDate(filtros.fim)}`);
  if (filtros.status && filtros.status !== "todos")
    partes.push(`${t("fields.status", "Status")}: ${t(`status.${filtros.status}`, filtros.status)}`);
  return partes.length ? partes.join(" • ") : t("pdf.allRecords", "Todos os registros");
}

export type OperacaoRow = {
  numero: string;
  cedentes?: { razao_social?: string } | null;
  sacados?: { nome?: string } | null;
  valor_principal: number | string;
  taxa_mensal: number | string;
  data_emissao: string;
  data_vencimento: string;
  status: string;
};

export function exportOperacoesPDF(
  ops: OperacaoRow[],
  filtros: { inicio?: string; fim?: string; status?: string }
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const subtitle = buildSubtitle(filtros);

  header(doc, t("pdf.operacoesTitle", "Relatório de Operações / CCBs"), subtitle);

  const total = ops.reduce((s, o) => s + Number(o.valor_principal), 0);

  autoTable(doc, {
    startY: 52,
    head: [[
      t("fields.number", "Número"),
      t("fields.cedente", "Cedente"),
      t("fields.sacado", "Sacado"),
      t("fields.value", "Valor"),
      t("pdf.rate", "Taxa"),
      t("pdf.issue", "Emissão"),
      t("pdf.dueDate", "Vencimento"),
      t("fields.status", "Status"),
    ]],
    body: ops.map((o) => [
      o.numero,
      o.cedentes?.razao_social ?? "-",
      o.sacados?.nome ?? "-",
      fmtMoney(Number(o.valor_principal)),
      `${Number(o.taxa_mensal).toFixed(2)}%`,
      fmtDate(o.data_emissao),
      fmtDate(o.data_vencimento),
      t(`status.${o.status}`, o.status),
    ]),
    foot: [["", "", t("common.total", "Total"), fmtMoney(total), "", "", "", `${ops.length} ${t("pdf.opsShort", "op.")}`]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  footer(doc);
  previewPdf(doc, `operacoes_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportDashboardPDF(
  ops: OperacaoRow[],
  filtros: { inicio?: string; fim?: string; status?: string }
) {
  const doc = new jsPDF();
  const subtitle = buildSubtitle(filtros);

  header(doc, t("pdf.dashboardTitle", "Relatório Executivo - Dashboard"), subtitle);

  const total = ops.reduce((s, o) => s + Number(o.valor_principal), 0);
  const ativa = ops.filter((o) => o.status === "ativa").reduce((s, o) => s + Number(o.valor_principal), 0);
  const liquidada = ops.filter((o) => o.status === "liquidada").reduce((s, o) => s + Number(o.valor_principal), 0);
  const inad = ops.filter((o) => o.status === "inadimplente").reduce((s, o) => s + Number(o.valor_principal), 0);
  const inadPct = total ? (inad / total) * 100 : 0;

  autoTable(doc, {
    startY: 52,
    head: [[t("pdf.indicator", "Indicador"), t("fields.value", "Valor")]],
    body: [
      [t("pdf.portfolioTotal", "Carteira total"), fmtMoney(total)],
      [t("pdf.portfolioActive", "Carteira ativa"), fmtMoney(ativa)],
      [t("pdf.portfolioLiquidated", "Carteira liquidada"), fmtMoney(liquidada)],
      [t("pdf.defaultRate", "Inadimplência"), `${fmtMoney(inad)} (${inadPct.toFixed(1)}%)`],
      [t("pdf.totalOps", "Total de operações"), String(ops.length)],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  const statusList = ["rascunho", "ativa", "liquidada", "inadimplente", "cancelada"];
  const statusBody = statusList.map((s) => {
    const arr = ops.filter((o) => o.status === s);
    const v = arr.reduce((acc, o) => acc + Number(o.valor_principal), 0);
    return [t(`status.${s}`, s), String(arr.length), fmtMoney(v)];
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [[t("fields.status", "Status"), t("pdf.qty", "Qtd."), t("fields.value", "Valor")]],
    body: statusBody,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [[
      t("fields.number", "Número"),
      t("fields.cedente", "Cedente"),
      t("fields.sacado", "Sacado"),
      t("fields.value", "Valor"),
      t("pdf.dueDate", "Vencimento"),
      t("fields.status", "Status"),
    ]],
    body: ops.slice(0, 20).map((o) => [
      o.numero,
      o.cedentes?.razao_social ?? "-",
      o.sacados?.nome ?? "-",
      fmtMoney(Number(o.valor_principal)),
      fmtDate(o.data_vencimento),
      t(`status.${o.status}`, o.status),
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 3: { halign: "right" } },
  });

  footer(doc);
  previewPdf(doc, `dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
}

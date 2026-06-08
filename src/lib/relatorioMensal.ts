import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { previewPdf } from "@/lib/pdfPreview";
import jhlLogo from "@/assets/jhl-logo.png";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | Date | null) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return dt.toLocaleDateString("pt-BR");
};
const fmtPct = (n: number, frac = 2) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac })}%`;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// dias úteis entre (from, to] — exclusivo no início, inclusivo no fim
const diasUteis = (from: Date, to: Date) => {
  if (to <= from) return 0;
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  cur.setDate(cur.getDate() + 1);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const ultimoDiaMes = (ano: number, mes: number) => new Date(ano, mes, 0); // mes 1..12

export type VendaInput = {
  id?: string;
  valor: number;
  data_venda: string;
  debenture?: {
    nome?: string | null;
    rentabilidade_anual?: number | null;
    tipo_taxa?: string | null;
    data_vencimento?: string | null;
  } | null;
};

export type RetiradaInput = {
  venda_id?: string | null;
  data_retirada: string;
  tipo?: string | null; // 'rendimento' | 'principal' | 'total'
  valor_retirado: number;
  rendimento_bruto?: number | null;
  valor_ir_retido?: number | null;
  rendimento_liquido?: number | null;
};

export type Debenturista = {
  nome: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
};

function rendimentoAcumulado(valor: number, rentAnual: number, dataVenda: Date, ate: Date) {
  if (ate <= dataVenda) return 0;
  const du = diasUteis(dataVenda, ate);
  if (du <= 0) return 0;
  const taxaDiaria = Math.pow(1 + rentAnual / 100, 1 / 252) - 1;
  return valor * (Math.pow(1 + taxaDiaria, du) - 1);
}

// Parcelas (rendimento, principal) acumuladas das retiradas de uma venda até `ate`
function parcelasRetiradas(retiradas: RetiradaInput[], ate: Date) {
  let rend = 0, principal = 0;
  for (const r of retiradas) {
    const dr = new Date(r.data_retirada + "T00:00:00");
    if (isNaN(dr.getTime()) || dr > ate) continue;
    const valor = Number(r.valor_retirado || 0);
    const rb = Number(r.rendimento_bruto || 0);
    rend += rb;
    principal += Math.max(0, valor - rb);
  }
  return { rend, principal };
}

export function buildRelatorioMensal(
  deb: Debenturista,
  vendas: VendaInput[],
  ano: number,
  mes: number, // 1..12
  retiradas: RetiradaInput[] = []
): { doc: jsPDF; filename: string } {

  const fimMes = ultimoDiaMes(ano, mes);
  const fimMesAnterior = new Date(ano, mes - 1, 0);
  const inicioMes = new Date(ano, mes - 1, 1);

  const ativas = vendas.filter((v) => {
    const dv = new Date(v.data_venda + "T00:00:00");
    return !isNaN(dv.getTime()) && dv <= fimMes;
  });

  // Agrupa retiradas por venda_id
  const retPorVenda = new Map<string, RetiradaInput[]>();
  for (const r of retiradas) {
    const key = r.venda_id || "";
    if (!retPorVenda.has(key)) retPorVenda.set(key, []);
    retPorVenda.get(key)!.push(r);
  }

  // Linhas da tabela "Investimentos"
  let totalSaldo = 0, totalRendAnt = 0, totalRendAtual = 0;
  const linhas = ativas.map((v) => {
    const dv = new Date(v.data_venda + "T00:00:00");
    const valor = Number(v.valor || 0);
    const rent = Number(v.debenture?.rentabilidade_anual || 0);
    const tipo = (v.debenture?.tipo_taxa || "FIXA").toUpperCase();
    const rets = retPorVenda.get(v.id || "") || [];

    const pAnt = parcelasRetiradas(rets, fimMesAnterior);
    const pAtu = parcelasRetiradas(rets, fimMes);

    const principalAnt = Math.max(0, valor - pAnt.principal);
    const principalAtu = Math.max(0, valor - pAtu.principal);
    const rendBrutoAnt = Math.max(0, rendimentoAcumulado(valor, rent, dv, fimMesAnterior) - pAnt.rend);
    const rendBrutoAtu = Math.max(0, rendimentoAcumulado(valor, rent, dv, fimMes) - pAtu.rend);

    const saldoAnt = principalAnt + rendBrutoAnt;
    const saldoAtu = principalAtu + rendBrutoAtu;

    totalSaldo += principalAtu;
    totalRendAnt += saldoAnt;
    totalRendAtual += saldoAtu;

    return [
      fmtDate(v.data_venda),
      fmtDate(v.debenture?.data_vencimento || null),
      `${fmtPct(rent)}\n${tipo}`,
      fmtBRL(principalAtu),
      fmtBRL(saldoAnt),
      fmtBRL(saldoAtu),
    ];
  });

  // Retiradas do mês
  const retirNoMes = retiradas.filter((r) => {
    const dr = new Date(r.data_retirada + "T00:00:00");
    return !isNaN(dr.getTime()) && dr >= inicioMes && dr <= fimMes;
  });
  const vendaPorId = new Map(ativas.map((v) => [v.id || "", v]));
  let totalRetValor = 0, totalRetRend = 0, totalRetPrinc = 0;
  const linhasRetiradas = retirNoMes.map((r) => {
    const v = vendaPorId.get(r.venda_id || "");
    const valor = Number(r.valor_retirado || 0);
    const rb = Number(r.rendimento_bruto || 0);
    const principal = Math.max(0, valor - rb);
    totalRetValor += valor; totalRetRend += rb; totalRetPrinc += principal;
    return [
      fmtDate(r.data_retirada),
      fmtDate(v?.data_venda || null),
      (r.tipo || "rendimento").toUpperCase(),
      fmtBRL(principal),
      fmtBRL(valor),
      fmtBRL(rb),
    ];
  });

  // Rendimento do mês = (saldo atual - saldo anterior) + retiradas de rendimento no mês
  const rendMes = (totalRendAtual - totalRendAnt) + totalRetRend;
  const pctMes = totalRendAnt > 0 ? (rendMes / totalRendAnt) * 100 : 0;
  const pctGlobal = totalSaldo > 0 ? ((totalRendAtual - totalSaldo) / totalSaldo) * 100 : 0;

  // Evolução mensal
  const evolucao: { label: string; saldo: number }[] = [];
  if (ativas.length > 0) {
    const primeira = ativas.reduce(
      (min, v) => (new Date(v.data_venda) < new Date(min.data_venda) ? v : min),
      ativas[0]
    );
    const dPrim = new Date(primeira.data_venda + "T00:00:00");
    let ano2 = dPrim.getFullYear();
    let mes2 = dPrim.getMonth() + 1;
    while (ano2 < ano || (ano2 === ano && mes2 <= mes)) {
      const fim = ultimoDiaMes(ano2, mes2);
      let saldoMes = 0;
      ativas.forEach((v) => {
        const dv = new Date(v.data_venda + "T00:00:00");
        if (dv > fim) return;
        const valor = Number(v.valor || 0);
        const rent = Number(v.debenture?.rentabilidade_anual || 0);
        const rets = retPorVenda.get(v.id || "") || [];
        const p = parcelasRetiradas(rets, fim);
        const principalRest = Math.max(0, valor - p.principal);
        const rendRest = Math.max(0, rendimentoAcumulado(valor, rent, dv, fim) - p.rend);
        saldoMes += principalRest + rendRest;
      });
      evolucao.push({ label: `${String(mes2).padStart(2, "0")}/${ano2}`, saldo: saldoMes });
      mes2++;
      if (mes2 > 12) { mes2 = 1; ano2++; }
    }
  }

  // ===== PDF =====
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("AUREA SECURITIZADORA", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Relatório Mensal para Investidores · ${MESES[mes - 1]} de ${ano}`, 14, 19);
  doc.addImage(jhlLogo, "PNG", pageW - 14 - 16, 6, 16, 16);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(deb.nome, 14, 38);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text([deb.documento, deb.email, deb.telefone].filter(Boolean).join("  ·  "), 14, 44);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Modalidade dos investimentos", 14, 54);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const modalidade =
    "Debêntures emitidas pela Securitizadora. As debêntures são uma forma de investimento em renda fixa, simples e quirografárias, não conversíveis em ações, com data de vencimento prevista na emissão e liquidação do investimento (valor principal + rendimento).";
  const linhasMod = doc.splitTextToSize(modalidade, pageW - 28);
  doc.text(linhasMod, 14, 60);

  autoTable(doc, {
    startY: 60 + linhasMod.length * 4 + 6,
    head: [[
      "Data Investimento",
      "Data Vencimento",
      "Rend.",
      "Saldo investido",
      `Saldo até ${fmtDate(fimMesAnterior)}`,
      `Saldo até ${fmtDate(fimMes)}`,
    ]],
    body: linhas,
    foot: [[
      { content: "Total", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      fmtBRL(totalSaldo),
      fmtBRL(totalRendAnt),
      fmtBRL(totalRendAtual),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, valign: "middle" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("*Saldo = principal restante + rendimento acumulado, descontadas retiradas.", 14, (doc as any).lastAutoTable.finalY + 5);
  doc.setTextColor(0);

  // Retiradas
  let y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Retiradas no período", 14, y);

  if (linhasRetiradas.length === 0) {
    autoTable(doc, {
      startY: y + 2,
      head: [["Data Retirada", "Data Investimento", "Tipo", "Vlr. Principal", "Vlr. Retirado", "Rendimento"]],
      body: [[{ content: "Nenhuma retirada no período.", colSpan: 6, styles: { halign: "center", textColor: 120 } }]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    });
  } else {
    autoTable(doc, {
      startY: y + 2,
      head: [["Data Retirada", "Data Investimento", "Tipo", "Vlr. Principal", "Vlr. Retirado", "Rendimento"]],
      body: linhasRetiradas,
      foot: [[
        { content: "Total", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
        fmtBRL(totalRetPrinc),
        fmtBRL(totalRetValor),
        fmtBRL(totalRetRend),
      ]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" },
        3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
      },
    });
  }

  // Desempenho
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Desempenho da carteira", 14, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const desempenho =
    `Parabéns! Seus investimentos renderam ${fmtBRL(rendMes)} no mês de ${MESES[mes - 1]} de ${ano}, ` +
    `o que representa ${fmtPct(pctMes)} no mês. Considerando a rentabilidade global da carteira, ` +
    `seus investimentos renderam ${fmtPct(pctGlobal)} até ${fmtDate(fimMes)}, totalizando ${fmtBRL(totalRendAtual)} em saldo. ` +
    `No período foram realizadas retiradas no valor total de ${fmtBRL(totalRetValor)}.`;
  const linhasDes = doc.splitTextToSize(desempenho, pageW - 28);
  doc.text(linhasDes, 14, y + 6);

  // ===== Página 2: evolução =====
  if (evolucao.length > 0) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("AUREA SECURITIZADORA", 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Evolução da carteira · ${MESES[mes - 1]} de ${ano}`, 14, 19);
    doc.addImage(jhlLogo, "PNG", pageW - 14 - 16, 6, 16, 16);
    doc.setTextColor(0);

    const gx = 20, gy = 40, gw = pageW - 40, gh = 80;
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(gx, gy, gw, gh);
    const maxV = Math.max(...evolucao.map((e) => e.saldo), 1);
    const minV = Math.min(...evolucao.map((e) => e.saldo), 0);
    const range = Math.max(maxV - minV, 1);
    const stepX = evolucao.length > 1 ? gw / (evolucao.length - 1) : 0;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    for (let i = 1; i < evolucao.length; i++) {
      const x1 = gx + (i - 1) * stepX;
      const y1 = gy + gh - ((evolucao[i - 1].saldo - minV) / range) * gh;
      const x2 = gx + i * stepX;
      const y2 = gy + gh - ((evolucao[i].saldo - minV) / range) * gh;
      doc.line(x1, y1, x2, y2);
    }
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(fmtBRL(maxV), gx + gw + 1, gy + 3);
    doc.text(fmtBRL(minV), gx + gw + 1, gy + gh);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: gy + gh + 10,
      head: [["Mês/Ano", "Saldo total (valor + rendimento)", "Índice CDI"]],
      body: evolucao.map((e) => [e.label, fmtBRL(e.saldo), "-"]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "center" } },
    });
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, pageH - 8);
    doc.text(`Pág ${i} de ${total}`, pageW - 14, pageH - 8, { align: "right" });
  }

  const safe = deb.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { doc, filename: `${safe}-${String(mes).padStart(2, "0")}-${ano}.pdf` };
}

export function gerarRelatorioMensal(
  deb: Debenturista,
  vendas: VendaInput[],
  ano: number,
  mes: number,
  retiradas: RetiradaInput[] = []
) {
  const { doc, filename } = buildRelatorioMensal(deb, vendas, ano, mes, retiradas);
  previewPdf(doc, filename);
}

// ============== XLSX export ==============

const num = (n: number) => Number(n || 0);

export function buildRelatorioMensalXlsx(
  deb: Debenturista,
  vendas: VendaInput[],
  ano: number,
  mes: number,
  retiradas: RetiradaInput[] = []
): { wb: XLSX.WorkBook; filename: string } {
  const fimMes = ultimoDiaMes(ano, mes);
  const fimMesAnterior = new Date(ano, mes - 1, 0);
  const inicioMes = new Date(ano, mes - 1, 1);

  const ativas = vendas.filter((v) => {
    const dv = new Date(v.data_venda + "T00:00:00");
    return !isNaN(dv.getTime()) && dv <= fimMes;
  });

  const retPorVenda = new Map<string, RetiradaInput[]>();
  for (const r of retiradas) {
    const key = r.venda_id || "";
    if (!retPorVenda.has(key)) retPorVenda.set(key, []);
    retPorVenda.get(key)!.push(r);
  }

  const resumoRows: (string | number)[][] = [
    ["Relatório Mensal", `${MESES[mes - 1]} ${ano}`],
    ["Cliente", deb.nome],
    ["Documento", deb.documento || ""],
    ["E-mail", deb.email || ""],
    ["Telefone", deb.telefone || ""],
    [],
  ];

  const invHeader = [
    "Data Investimento", "Data Vencimento", "Debênture",
    "Rentabilidade (% a.a.)", "Tipo Taxa",
    "Valor original", "Principal restante",
    `Saldo até ${fmtDate(fimMesAnterior)}`, `Saldo até ${fmtDate(fimMes)}`,
    "Rendimento no mês",
  ];
  const invRows: (string | number)[][] = [];
  let totValor = 0, totPrincipal = 0, totSaldoAnt = 0, totSaldoAtu = 0, totRendMes = 0;
  for (const v of ativas) {
    const dv = new Date(v.data_venda + "T00:00:00");
    const valor = num(v.valor);
    const rent = num(v.debenture?.rentabilidade_anual || 0);
    const tipo = (v.debenture?.tipo_taxa || "FIXA").toUpperCase();
    const rets = retPorVenda.get(v.id || "") || [];
    const pAnt = parcelasRetiradas(rets, fimMesAnterior);
    const pAtu = parcelasRetiradas(rets, fimMes);
    const principalAtu = Math.max(0, valor - pAtu.principal);
    const rBrutoAnt = Math.max(0, rendimentoAcumulado(valor, rent, dv, fimMesAnterior) - pAnt.rend);
    const rBrutoAtu = Math.max(0, rendimentoAcumulado(valor, rent, dv, fimMes) - pAtu.rend);
    const saldoAnt = Math.max(0, valor - pAnt.principal) + rBrutoAnt;
    const saldoAtu = principalAtu + rBrutoAtu;
    const retRendMes = rets
      .filter((r) => {
        const dr = new Date(r.data_retirada + "T00:00:00");
        return !isNaN(dr.getTime()) && dr >= inicioMes && dr <= fimMes;
      })
      .reduce((s, r) => s + num(r.rendimento_bruto || 0), 0);
    const rendMesLinha = (saldoAtu - saldoAnt) + retRendMes;
    totValor += valor; totPrincipal += principalAtu;
    totSaldoAnt += saldoAnt; totSaldoAtu += saldoAtu; totRendMes += rendMesLinha;
    invRows.push([
      fmtDate(v.data_venda), fmtDate(v.debenture?.data_vencimento || null),
      v.debenture?.nome || "", rent, tipo,
      valor, principalAtu, saldoAnt, saldoAtu, rendMesLinha,
    ]);
  }
  invRows.push(["TOTAL", "", "", "", "", totValor, totPrincipal, totSaldoAnt, totSaldoAtu, totRendMes]);

  const retirNoMes = retiradas.filter((r) => {
    const dr = new Date(r.data_retirada + "T00:00:00");
    return !isNaN(dr.getTime()) && dr >= inicioMes && dr <= fimMes;
  });
  const vendaPorId = new Map(ativas.map((v) => [v.id || "", v]));
  const retHeader = [
    "Data Retirada", "Data Investimento", "Tipo",
    "Vlr. Principal", "Vlr. Retirado", "Rendimento bruto",
    "IR retido", "Rendimento líquido",
  ];
  const retRows: (string | number)[][] = [];
  let tValor = 0, tRend = 0, tPrinc = 0, tIR = 0, tLiq = 0;
  for (const r of retirNoMes) {
    const v = vendaPorId.get(r.venda_id || "");
    const valor = num(r.valor_retirado);
    const rb = num(r.rendimento_bruto || 0);
    const ir = num(r.valor_ir_retido || 0);
    const liq = num(r.rendimento_liquido || 0);
    const principal = Math.max(0, valor - rb);
    tValor += valor; tRend += rb; tPrinc += principal; tIR += ir; tLiq += liq;
    retRows.push([
      fmtDate(r.data_retirada), fmtDate(v?.data_venda || null),
      (r.tipo || "rendimento").toUpperCase(),
      principal, valor, rb, ir, liq,
    ]);
  }
  retRows.push(["TOTAL", "", "", tPrinc, tValor, tRend, tIR, tLiq]);

  const rendMesTotal = (totSaldoAtu - totSaldoAnt) + tRend;
  const pctMes = totSaldoAnt > 0 ? (rendMesTotal / totSaldoAnt) * 100 : 0;
  const pctGlobal = totPrincipal > 0 ? ((totSaldoAtu - totPrincipal) / totPrincipal) * 100 : 0;
  resumoRows.push(
    ["Total investido (original)", totValor],
    ["Principal restante", totPrincipal],
    [`Saldo até ${fmtDate(fimMesAnterior)}`, totSaldoAnt],
    [`Saldo até ${fmtDate(fimMes)}`, totSaldoAtu],
    ["Rendimento no mês", rendMesTotal],
    ["% Mês", pctMes],
    ["% Acumulado (global)", pctGlobal],
    ["Retiradas no mês (valor)", tValor],
    ["Retiradas no mês (rendimento)", tRend],
  );

  const wb = XLSX.utils.book_new();
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const wsInv = XLSX.utils.aoa_to_sheet([invHeader, ...invRows]);
  wsInv["!cols"] = [
    { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 12 },
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInv, "Investimentos");

  const wsRet = XLSX.utils.aoa_to_sheet([retHeader, ...retRows]);
  wsRet["!cols"] = [
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRet, "Retiradas");

  const safe = deb.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `${safe}-${String(mes).padStart(2, "0")}-${ano}.xlsx`;
  return { wb, filename };
}

export function gerarRelatorioMensalXlsx(
  deb: Debenturista,
  vendas: VendaInput[],
  ano: number,
  mes: number,
  retiradas: RetiradaInput[] = []
) {
  const { wb, filename } = buildRelatorioMensalXlsx(deb, vendas, ano, mes, retiradas);
  XLSX.writeFile(wb, filename);
}



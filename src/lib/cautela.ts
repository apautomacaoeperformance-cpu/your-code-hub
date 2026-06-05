import { jsPDF } from "jspdf";
import { previewPdf } from "@/lib/pdfPreview";

// Conversor simples de número para extenso em português (reais)
const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(centenas[c]);
  if (r < 20) {
    if (r) partes.push(unidades[r]);
  } else {
    const d = Math.floor(r / 10);
    const u = r % 10;
    partes.push(dezenas[d] + (u ? " e " + unidades[u] : ""));
  }
  return partes.join(" e ");
}

function numeroExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhoes) partes.push(ate999(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  if (milhares) partes.push(milhares === 1 ? "mil" : ate999(milhares) + " mil");
  if (resto) partes.push(ate999(resto));
  return partes.join(" e ");
}

export function valorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const cent = Math.round((valor - inteiro) * 100);
  let s = numeroExtenso(inteiro) + (inteiro === 1 ? " real" : " reais");
  if (cent > 0) s += " e " + numeroExtenso(cent) + (cent === 1 ? " centavo" : " centavos");
  return s;
}

const mesesExt = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtDataExtenso(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${mesesExt[d.getMonth()]}/${d.getFullYear()}`;
}

function fmtData(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type CautelaData = {
  numero: string;
  quantidade: number;
  valorUnitario: number;
  remuneracao: string;
  vencimento: string;
  investidor: string;
  dataVenda: string;
};

export function gerarCautelaPDF(d: CautelaData) {
  const doc = new jsPDF("l", "mm", "a4");
  const W = doc.internal.pageSize.getWidth();
  const M = 20;
  const contentW = W - M * 2;

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("JHL SECURITIZADORA S/A", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("CNPJ 66.352.239/0001-39", M, 17);
  doc.setTextColor(0, 0, 0);

  let y = 34;
  doc.setFontSize(9);
  const writePara = (text: string, opts?: { bold?: boolean; align?: "left" | "center"; size?: number }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    const lh = (opts?.size ?? 10) * 0.45 + 1.5;
    if (opts?.align === "center") {
      lines.forEach((l, i) => doc.text(l, W / 2, y + i * lh, { align: "center" }));
    } else {
      doc.text(lines, M, y);
    }
    y += lines.length * lh;
  };

  writePara("Data de Constituição da Sociedade: 21/04/2026, com seus atos constitutivos arquivados na Junta Comercial do Estado Mato Grosso do Sul, em 24/10/2023.", { size: 9 });
  y += 1;
  writePara("Objeto Social: O único objeto da sociedade consiste, especificamente, na securitização (Lei 14.430/22).", { size: 9 });
  y += 1;
  writePara("Prazo de Duração da Sociedade: Indeterminado", { size: 9 });

  y += 8;
  writePara("DEBÊNTURES SIMPLES, QUIROGRAFÁRIA", { bold: true, align: "center", size: 13 });

  y += 6;
  writePara(`Cautela Número: ${d.numero}`, { bold: true, size: 11 });
  y += 1;
  writePara(`Quantidade de Debêntures: ${d.quantidade}`, { bold: true, size: 11 });

  y += 6;
  const valorUnitFmt = fmtMoney(d.valorUnitario);
  const valorExt = valorExtenso(d.valorUnitario);
  const corpo = `Esta cautela representativa de ${d.quantidade} debênture${d.quantidade > 1 ? "s" : ""}, não conversíve${d.quantidade > 1 ? "is" : "l"} em ações, da 1ª emissão privada, 1ª série, no valor nominal unitário de ${valorUnitFmt} (${valorExt}) com a remuneração de ${d.remuneracao} e vencimento em ${fmtData(d.vencimento)}, com as características especificadas no Instrumento Particular de Escritura da Primeira Emissão de Debêntures Simples, confere a ${d.investidor.toUpperCase()} os direitos que a Lei e a Escritura de Emissão lhes asseguram.`;
  writePara(corpo, { size: 10 });

  y += 12;
  writePara(`Campo Grande, ${fmtDataExtenso(d.dataVenda)}`, { bold: true, align: "center" });

  y += 30;
  doc.setDrawColor(60);
  const lineW = 90;
  doc.line(W / 2 - lineW / 2, y, W / 2 + lineW / 2, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("JHL SECURITIZADORA S/A", W / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("CNPJ: 66.352.239/0001-39", W / 2, y + 9.5, { align: "center" });

  const slug = (d.investidor || "investidor")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  previewPdf(doc, `cautela_${d.numero}_${slug}.pdf`);
}

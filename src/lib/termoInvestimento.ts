import jsPDF from "jspdf";
import { previewPdf } from "@/lib/pdfPreview";
import { supabase } from "@/integrations/supabase/client";
import { maskDocumento, maskCEP } from "@/lib/simulador/formatters";


export type DebenturistaTermo = {
  id: string;
  nome: string;
  tipo: string;
  documento?: string | null;
  rg?: string | null;
  orgao_emissor?: string | null;
  email?: string | null;
  telefone?: string | null;
  estado_civil?: string | null;
  profissao?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
};

export type CedenteTermo = {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

const PAGE_MARGIN = 15;
const HEADER_H = 22;


function pageHeader(doc: jsPDF) {
  doc.setFillColor(25, 45, 77);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), HEADER_H, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("AUREA SECURITIZADORA S/A", PAGE_MARGIN, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  // Removido título secundário do cabeçalho

  doc.setTextColor(0, 0, 0);
}

function pageFooter(doc: jsPDF) {
  // Rodapé removido conforme solicitado
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 18) {
    doc.addPage();
    pageHeader(doc);
    return HEADER_H + 12;
  }
  return y;
}

function writeParagraph(doc: jsPDF, text: string, y: number, opts?: { bold?: boolean; size?: number; align?: "left" | "justify" | "center" }): number {
  const w = doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2;
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(opts?.size ?? 11);
  const lines = doc.splitTextToSize(text, w) as string[];
  const lineH = (opts?.size ?? 11) * 0.4 + 1.2;
  y = ensureSpace(doc, y, lines.length * lineH);
  
  if (opts?.align === "center") {
    lines.forEach((line, idx) => {
      doc.text(line, doc.internal.pageSize.getWidth() / 2, y + idx * lineH, { align: "center" });
    });
  } else {
    doc.text(lines, PAGE_MARGIN, y);
  }
  return y + lines.length * lineH;
}

function writeSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 12);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(25, 45, 77);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  return y + 4;

}

function formatDateExtenso(d: Date): string {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${String(d.getDate()).padStart(2,"0")} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

async function fetchTermoTemplate(): Promise<string> {
  const { data } = await supabase
    .from("app_parameters")
    .select("value")
    .eq("key", "termo_investidor_qualificado")
    .maybeSingle();
  return data?.value || "";
}

function renderTemplate(
  doc: jsPDF,
  template: string,
  vars: Record<string, string>,
  startY: number
): { y: number; dataY: number } {

  // Replace placeholders
  let text = template;
  for (const [key, value] of Object.entries(vars)) {
    let formattedValue = value || "_______________";
    if (key === "cpf" || key === "documento") {
      formattedValue = maskDocumento(value || "");
    }
    text = text.split(`{{${key}}}`).join(formattedValue || "_______________");
  }


  // Split by sections and paragraphs
  let y = startY;
  let dataY = startY;
  const parts = text.split(/\n\n+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(/^\[SECTION\](.+?)\[\/SECTION\]$/s);
    if (sectionMatch) {
      y = writeSectionTitle(doc, sectionMatch[1].trim(), y);
    } else {
      // Se o parágrafo contém a data, adicionamos um espaço extra antes dele
      const isData = trimmed.includes(" de ") && trimmed.includes(" de 202");
      if (isData) {
        y += 15; // Desce com o campo data
        dataY = y;
      }
      
      y = writeParagraph(doc, trimmed, y);
      y += 2.5;
    }
  }

  return { y, dataY };
}



function buildEndereco(d: DebenturistaTermo): string {
  const partes = [
    [d.rua, d.numero].filter(Boolean).join(", "),
    d.complemento,
    d.bairro,
    [d.cidade, d.estado].filter(Boolean).join(" / "),
    d.cep ? `CEP ${maskCEP(d.cep)}` : null,
  ].filter((p) => p && String(p).trim().length);
  return partes.join(" — ") || "_______________";
}

function renderSignature(doc: jsPDF, contentY: number, dataY: number, nome: string, cpf?: string | null) {
  // Subir com o campo de assinatura: reduzimos o espaço entre o conteúdo e as linhas de assinatura
  let y = contentY + 10;




  y = ensureSpace(doc, y, 70);
  y += 25;




  const w = doc.internal.pageSize.getWidth();
  const lineW = 90;

  // Empresa
  const lineX1 = (w / 2 - lineW) / 2 + (w / 4 - lineW / 2);
  doc.setDrawColor(60);
  doc.line(w / 4 - lineW / 2, y, w / 4 + lineW / 2, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AUREA SECURITIZADORA S/A", w / 4, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text("CNPJ: 66.352.239/0001-39", w / 4, y + 9.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Investidor
  doc.setDrawColor(60);
  doc.line((3 * w) / 4 - lineW / 2, y, (3 * w) / 4 + lineW / 2, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(nome || "INVESTIDOR", (3 * w) / 4, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(`${(cpf || "").replace(/\D/g, "").length <= 11 ? "CPF" : "CNPJ"}: ${cpf ? maskDocumento(cpf) : "—"}`, (3 * w) / 4, y + 9.5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  y += 15;
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(
    "Assinatura digital com validade jurídica (MP 2.200-2/2001).",
    w / 2,
    y,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
}

export async function gerarTermoInvestimentoPDF(d: DebenturistaTermo) {
  const template = await fetchTermoTemplate();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  pageHeader(doc);

  let y = HEADER_H + 15;


  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TERMO DE INVESTIDOR QUALIFICADO", doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 6;


  // Render template
  const { y: contentY, dataY } = renderTemplate(doc, template, {
    nome: d.nome || "",
    cpf: d.documento || "",
    endereco: buildEndereco(d),
    data: formatDateExtenso(new Date()),
  }, y);

  // Assinaturas
  renderSignature(doc, contentY, dataY, d.nome, d.documento);


  pageFooter(doc);

  const slug = (d.nome || "investidor")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  previewPdf(doc, `termo_investidor_${slug || "investidor"}.pdf`);
}

export async function gerarTermoCedentePDF(d: CedenteTermo) {
  const template = await fetchTermoTemplate();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  pageHeader(doc);

  let y = HEADER_H + 12;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TERMO DE INVESTIDOR QUALIFICADO", doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 6;


  // Render template
  const endereco = [
    d.endereco,
    [d.cidade, d.estado].filter(Boolean).join(" / "),
  ].filter(Boolean).join(" — ") || "_______________";

  const { y: contentY, dataY } = renderTemplate(doc, template, {
    nome: d.razao_social || "",
    cpf: d.cnpj || "",
    endereco,
    data: formatDateExtenso(new Date()),
  }, y);

  // Assinaturas
  renderSignature(doc, contentY, dataY, d.razao_social, d.cnpj);


  pageFooter(doc);

  const slug = (d.razao_social || "cedente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  previewPdf(doc, `termo_investidor_${slug || "cedente"}.pdf`);
}

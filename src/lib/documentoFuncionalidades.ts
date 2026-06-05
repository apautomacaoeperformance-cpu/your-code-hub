import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";

export async function gerarDocumentoFuncionalidadesPDF() {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Cabeçalho
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("JHL SECURITIZADORA S/A", margin, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Funcionalidades Implementadas", margin, 30);

  let y = 50;

  const addSection = (title: string, items: string[]) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    
    items.forEach(item => {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
      
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
    });
    y += 5;
  };

  addSection("1. Gestão de Debêntures", [
    "Cadastro e Edição: Controle completo de debêntures (Nome, Emissão, Série, Valor da Cota, Quantidade, Tipo de Taxa: FIXA ou CDI, Rentabilidade Anual, Status).",
    "Cotas Individuais: Geração automática de cotas sequenciais para cada debênture, com rastreamento de situação (Disponível, Vendida, Cancelada).",
    "Venda de Cotas: Fluxo de venda por quantidade ou valor investido, vinculando o investidor, o caixa de entrada e upload de comprovante de pagamento.",
    "Rendimentos Dinâmicos: Cálculos de capitalização diária (Taxa Fixa e CDI) e IR Regressivo automático.",
    "Relatórios PDF: Geração de relatórios consolidados em formato Paisagem (Landscape)."
  ]);

  addSection("2. Gestão de Clientes (Debenturistas)", [
    "Perfis PF/PJ: Cadastro detalhado de investidores com dados pessoais, bancários e de endereço.",
    "Documentação Legal: Geração do Termo de Investimento em PDF e gestão de termos assinados.",
    "Extratos do Investidor: Relatórios individuais detalhando todas as cotas, rendimentos acumulados e evolução percentual.",
    "Processamento em Lote: Funcionalidade para gerar e zipar relatórios mensais de todos os investidores."
  ]);

  addSection("3. Financeiro e Administrativo", [
    "Gestão de Caixas: Controle de contas bancárias e saldos de entrada.",
    "Sincronização CDI: Integração com o Banco Central para buscar as taxas diárias (SGS 12).",
    "Configurações de Feriados: Gestão de feriados para precisão no cálculo de dias úteis.",
    "Cautela PDF: Geração da Cautela (Certificado de Debêntures) em formato Paisagem."
  ]);

  addSection("4. Interface e Experiência (UI/UX)", [
    "Dashboard: Visão geral com métricas de cotas ativas e resumo financeiro.",
    "Modo Pulse: Interface moderna e responsiva utilizando Tailwind CSS.",
    "Internacionalização (i18n): Suporte completo para Português, Inglês e Espanhol."
  ]);

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} | Página ${i} de ${totalPages}`, pageWidth / 2, 287, { align: "center" });
  }

  previewPdf(doc, "funcionalidades_jhl_securitizadora.pdf");
}

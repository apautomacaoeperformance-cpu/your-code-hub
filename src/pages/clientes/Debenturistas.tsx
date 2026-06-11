import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { maskDocumento, maskCEP, maskPhone } from "@/lib/simulador/formatters";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Search, FileText, CalendarRange, FileSignature, Upload, Link as LinkIcon, Download, X, Eye, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";
import jhlLogo from "@/assets/jhl-logo.png";
import { gerarRelatorioMensal, buildRelatorioMensal, gerarRelatorioMensalXlsx, buildRelatorioMensalXlsx } from "@/lib/relatorioMensal";
import { gerarTermoInvestimentoPDF } from "@/lib/termoInvestimento";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { useFeriados, diasUteis as diasUteisFn } from "@/lib/diasUteis";
import { PdfViewer } from "@/components/PdfViewer";



const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function Debenturistas() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) => Number(n || 0).toLocaleString(locale, { style: "currency", currency: "BRL" });
  const fmtDate = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString(locale) : "-");

  const qc = useQueryClient();
  const { data: feriados } = useFeriados();
  const diasUteis = (from: string, to: Date = new Date()) => diasUteisFn(from, to, feriados);
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({ key: "nome", direction: "asc" });
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const hojeRef = new Date();
  const [mensalOpen, setMensalOpen] = useState(false);
  const [mensalDeb, setMensalDeb] = useState<any>(null);
  const [mensalMes, setMensalMes] = useState<number>(
    hojeRef.getMonth() === 0 ? 12 : hojeRef.getMonth()
  );
  const [mensalAno, setMensalAno] = useState<number>(
    hojeRef.getMonth() === 0 ? hojeRef.getFullYear() - 1 : hojeRef.getFullYear()
  );
  const [gerandoMensal, setGerandoMensal] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMes, setBulkMes] = useState<number>(hojeRef.getMonth() === 0 ? 12 : hojeRef.getMonth());
  const [bulkAno, setBulkAno] = useState<number>(hojeRef.getMonth() === 0 ? hojeRef.getFullYear() - 1 : hojeRef.getFullYear());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [viewingTermo, setViewingTermo] = useState<{ url: string; fileName: string } | null>(null);


  const { data: list = [] } = useQuery({
    queryKey: ["debenturistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debenturistas")
        .select("id,nome,documento,email,telefone,cidade,estado,ativo,status,created_at,termo_assinado_path")
        .eq("tipo", "PF")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = list.filter((d: any) => {
    const term = q.toLowerCase();
    return !term || [d.nome, d.documento, d.email, d.telefone].some((v: any) => (v || "").toLowerCase().includes(term));
  }).sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const valA = (a[sortConfig.key] || "").toString().toLowerCase();
    const valB = (b[sortConfig.key] || "").toString().toLowerCase();
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  const toggleSort = (key: string) => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  const SortIcon = ({ k }: { k: string }) =>
    sortConfig?.key === k ? (
      sortConfig.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
    ) : (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    );

  const handleStatus = async (id: string, status: "ativo" | "suspenso" | "cancelado") => {
    const { error } = await supabase
      .from("debenturistas")
      .update({ status, ativo: status === "ativo" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("debenturistas.statusUpdated", { status }));
    qc.invalidateQueries({ queryKey: ["debenturistas"] });
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  const handleDelete = (id: string, nome: string) => {
    setDeleteTarget({ id, nome });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("debenturistas").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) return toast.error(error.message);
    toast.success("Debenturista excluído");
    qc.invalidateQueries({ queryKey: ["debenturistas"] });
  };

  const gerarTermo = async (id: string) => {
    setGerandoId(id);
    const { data, error } = await supabase
      .from("debenturistas")
      .select("id,nome,tipo,documento,rg,orgao_emissor,email,telefone,estado_civil,profissao,rua,numero,complemento,bairro,cidade,estado,cep")
      .eq("id", id)
      .maybeSingle();
    
    if (error || !data) {
      setGerandoId(null);
      return toast.error(error?.message || "Debenturista não encontrado");
    }

    try {
      await gerarTermoInvestimentoPDF(data as any);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar termo");
    } finally {
      setGerandoId(null);
    }
  };

  const handleFileUpload = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const ext = file.name.split(".").pop();
      const path = `${id}/termo_assinado-${crypto.randomUUID()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("documentos-debenturistas")
        .upload(path, file);
      
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("debenturistas")
        .update({ termo_assinado_path: path })
        .eq("id", id);
      
      if (updateError) throw updateError;

      toast.success(t("debenturistas.termAttached"));
      qc.invalidateQueries({ queryKey: ["debenturistas"] });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("debenturistas.uploadError"));
    } finally {
      setUploadingId(null);
    }
  };

  const handleViewTermo = async (path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage.from("documentos-debenturistas").createSignedUrl(path, 60);
      if (error) throw error;
      
      const ext = path.split('.').pop()?.toLowerCase();
      const fileName = `termo_${nome.replace(/\s+/g, '_')}.${ext}`;
      
      if (ext === 'pdf') {
        setViewingTermo({ url: data.signedUrl, fileName });
      } else {
        window.open(data.signedUrl, "_blank");
      }
    } catch (e: any) {
      toast.error(t("debenturistas.viewError"));
    }
  };


  const aliquotaIR = (dc: number) => (dc <= 180 ? 22.5 : dc <= 360 ? 20 : dc <= 720 ? 17.5 : 15);
  const diasCorridos = (dataVenda: string, ate: Date = new Date()) => {
    const ini = new Date(dataVenda + "T00:00:00");
    return Math.max(0, Math.floor((ate.getTime() - ini.getTime()) / 86400000));
  };
  const calcLiquido = (rendBruto: number, dataVenda: string) =>
    rendBruto <= 0 ? rendBruto : rendBruto * (1 - aliquotaIR(diasCorridos(dataVenda)) / 100);

  const gerarRelatorioConsolidado = async (deb: any) => {
    setGerandoId(deb.id);
    try {
      const { data: vendas, error } = await supabase
        .from("vendas_debenture")
        .select("id, valor, data_venda, cota:cota_id(numero), debenture:debenture_id(id,nome,emissao,serie,rentabilidade_anual,tipo_taxa)")
        .eq("debenturista_id", deb.id)
        .order("data_venda", { ascending: true });
      if (error) throw error;

      if (!vendas || vendas.length === 0) {
        toast.warning(t("debenturistas.noCotas"));
        return;
      }

      // Carrega série CDI se houver alguma debênture CDI (mesma fórmula da tela DebentureDetalhe)
      const temCDI = (vendas as any[]).some((v) => (v.debenture?.tipo_taxa || "FIXA").toUpperCase() === "CDI");
      let cdiMap: Map<string, number> | null = null;
      if (temCDI) {
        const { data: cdiRows } = await supabase
          .from("cdi_diario")
          .select("data,taxa")
          .order("data", { ascending: true });
        cdiMap = new Map<string, number>();
        (cdiRows || []).forEach((r: any) => cdiMap!.set(r.data, Number(r.taxa) || 0));
      }
      const isoAdd = (iso: string, n: number) => {
        const d = new Date(iso + "T00:00:00");
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const toIso = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
      const calcRendimento = (valor: number, rentAnual: number, du: number, tipo: string, dataVenda: string) => {
        if (!valor) return 0;
        if (tipo === "CDI" && cdiMap && cdiMap.size) {
          const pctCDI = (rentAnual || 100) / 100;
          const endIso = toIso(new Date());
          let cur = isoAdd(dataVenda, 1);
          let fator = 1;
          let lastCdi = 0;
          const sortedDates = Array.from(cdiMap.keys()).sort();
          for (let i = sortedDates.length - 1; i >= 0; i--) {
            if (sortedDates[i] <= cur) { lastCdi = cdiMap.get(sortedDates[i]) || 0; break; }
          }
          while (cur <= endIso) {
            const dow = new Date(cur + "T00:00:00").getDay();
            const isHoliday = feriados?.has(cur);
            if (dow !== 0 && dow !== 6 && !isHoliday) {
              const t = cdiMap.get(cur);
              if (t != null) lastCdi = t;
              const usar = t ?? lastCdi;
              if (usar > 0) fator *= Math.pow(1 + usar / 100, pctCDI);
            }
            cur = isoAdd(cur, 1);
          }
          return valor * (fator - 1);
        }
        if (!rentAnual || !du) return 0;
        const taxaDiaria = Math.pow(1 + rentAnual / 100, 1 / 252) - 1;
        return valor * (Math.pow(1 + taxaDiaria, du) - 1);
      };

      type Grupo = { nome: string; emissao?: string; serie?: string; rent: number; qtd: number; total: number; rendimento: number; rendimentoLiq: number; linhas: any[] };
      const grupos = new Map<string, Grupo>();
      let totQtd = 0, totValor = 0, totRend = 0, totRendLiq = 0;

      vendas.forEach((v: any) => {
        const d = v.debenture;
        const rent = Number(d?.rentabilidade_anual || 0);
        const tipo = (d?.tipo_taxa || "FIXA").toUpperCase();
        const valor = Number(v.valor || 0);
        const du = diasUteis(v.data_venda);
        const rend = calcRendimento(valor, rent, du, tipo, v.data_venda);
        const rendLiq = calcLiquido(rend, v.data_venda);
        const key = d?.id || "—";
        const g = grupos.get(key) || { nome: d?.nome || "—", emissao: d?.emissao, serie: d?.serie, rent, qtd: 0, total: 0, rendimento: 0, rendimentoLiq: 0, linhas: [] };
        g.qtd += 1; g.total += valor; g.rendimento += rend; g.rendimentoLiq += rendLiq;
        g.linhas.push([
          v.cota?.numero || "-",
          fmtDate(v.data_venda),
          fmt(valor),
          fmt(rend),
          fmt(rendLiq),
          valor > 0 ? `${((rend / valor) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-",
        ]);
        grupos.set(key, g);
        totQtd += 1; totValor += valor; totRend += rend; totRendLiq += rendLiq;
      });


      const fmtPct = (n: number, base: number) =>
        base > 0 ? `${((n / base) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-";

      const linhasDetalhe: any[] = [];
      const subtotalRowIdx = new Set<number>();
      const groupHeaderRowIdx = new Set<number>();
      Array.from(grupos.values()).forEach((g) => {
        const titulo = `${g.nome}${g.emissao ? ` · Em. ${g.emissao}` : ""}${g.serie ? ` · Sér. ${g.serie}` : ""}`;
        groupHeaderRowIdx.add(linhasDetalhe.length);
        linhasDetalhe.push([{ content: titulo, colSpan: 6, styles: { fillColor: [226, 232, 240], fontStyle: "bold", textColor: 0 } }]);
        g.linhas.forEach((l) => linhasDetalhe.push(l));
        subtotalRowIdx.add(linhasDetalhe.length);
        linhasDetalhe.push([
          { content: t("debenturistas.subtotal", { n: g.qtd }), colSpan: 2, styles: { fontStyle: "bold", halign: "right" } },
          fmt(g.total),
          fmt(g.rendimento),
          fmt(g.rendimentoLiq),
          fmtPct(g.rendimento, g.total),
        ]);
      });

      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(25, 45, 77);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("AUREA SECURITIZADORA", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(t("debenturistas.reportTitle"), 14, 19);
      doc.addImage(jhlLogo, "PNG", pageW - 14 - 16, 6, 16, 16);
      doc.setTextColor(0, 0, 0);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(deb.nome, 14, 40);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(
        [deb.documento, deb.email, deb.telefone].filter(Boolean).join("  ·  "),
        14, 46
      );
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: 54,
        head: [[t("debenturistas.summary"), t("fields.value")]],
        body: [
          [t("debenturistas.totalCotas"), String(totQtd)],
          [t("debenturistas.totalInvested"), fmt(totValor)],
          [t("debenturistas.yieldAccum"), fmt(totRend)],
          [t("debentureDetalhe.rendimentoLiquido", "Rend. Líquido (IR reg.)"), fmt(totRendLiq)],
          [t("debenturistas.distinctDebentures"), String(grupos.size)],
        ],
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [25, 45, 77], textColor: 255 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        didParseCell: (data: any) => {
          if (data.section === "body" && (data.row.index === 2 || data.row.index === 3) && data.column.index === 1) {
            data.cell.styles.textColor = [22, 163, 74];
          }
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [[t("debenturistas.debenture"), t("debenturistas.cotas"), t("debenturistas.totalValue"), t("debenturistas.yieldShort"), t("debentureDetalhe.colRendLiquido", "Rend. Líquido"), "% Evol."]],
        body: Array.from(grupos.values()).map((g) => [
          `${g.nome}${g.emissao ? ` · Em. ${g.emissao}` : ""}${g.serie ? ` · Sér. ${g.serie}` : ""}`,
          String(g.qtd),
          fmt(g.total),
          fmt(g.rendimento),
          fmt(g.rendimentoLiq),
          fmtPct(g.rendimento, g.total),
        ]),
        foot: [[t("debenturistas.total"), String(totQtd), fmt(totValor), fmt(totRend), fmt(totRendLiq), fmtPct(totRend, totValor)]],
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [25, 45, 77], textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        didParseCell: (data: any) => {
          if ((data.column.index === 3 || data.column.index === 4 || data.column.index === 5) && (data.section === "body" || data.section === "foot")) {
            data.cell.styles.textColor = [22, 163, 74];
          }
        },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [[t("debenturistas.cota"), t("debenturistas.saleDate"), t("debenturistas.value"), t("debenturistas.yieldShort"), t("debentureDetalhe.colRendLiquido", "Rend. Líquido"), "% Evol."]],
        body: linhasDetalhe,
        foot: [[{ content: t("debenturistas.grandTotal"), colSpan: 2, styles: { halign: "right" } }, fmt(totValor), fmt(totRend), fmt(totRendLiq), fmtPct(totRend, totValor)]],
        showFoot: "lastPage",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [25, 45, 77], textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        didParseCell: (data: any) => {
          if (data.section === "body" && groupHeaderRowIdx.has(data.row.index)) return;
          if (data.section === "body" && subtotalRowIdx.has(data.row.index)) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = "bold";
            if (data.column.index === 3 || data.column.index === 4 || data.column.index === 5) data.cell.styles.textColor = [22, 163, 74];
            return;
          }
          if ((data.column.index === 3 || data.column.index === 4 || data.column.index === 5) && (data.section === "body" || data.section === "foot")) {
            data.cell.styles.textColor = [22, 163, 74];
          }
        },
        didDrawPage: () => {
          const h = doc.internal.pageSize.getHeight();
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(new Date().toLocaleString(locale), 14, h - 8);
        },
      });

      previewPdf(doc, `relatorio_${deb.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("debenturistas.reportError"));
    } finally {
      setGerandoId(null);
    }
  };

  const abrirMensal = (deb: any) => {
    setMensalDeb(deb);
    setMensalOpen(true);
  };

  const fetchDadosMensal = async (debId: string) => {
    const [{ data: vendas, error }, { data: retiradas, error: errR }] = await Promise.all([
      supabase
        .from("vendas_debenture")
        .select("id, valor, data_venda, debenture:debenture_id(nome,rentabilidade_anual,tipo_taxa,data_vencimento)")
        .eq("debenturista_id", debId)
        .order("data_venda", { ascending: true }),
      supabase
        .from("retiradas_debenture")
        .select("venda_id, data_retirada, tipo, valor_retirado, rendimento_bruto, valor_ir_retido, rendimento_liquido")
        .eq("debenturista_id", debId)
        .order("data_retirada", { ascending: true }),
    ]);
    if (error) throw error;
    if (errR) throw errR;
    return { vendas: vendas ?? [], retiradas: retiradas ?? [] };
  };

  const confirmarMensal = async (formato: "pdf" | "xlsx" = "pdf") => {
    if (!mensalDeb) return;
    setGerandoMensal(true);
    try {
      const { vendas, retiradas } = await fetchDadosMensal(mensalDeb.id);
      if (vendas.length === 0) {
        toast.warning(t("debenturistas.noCotas"));
        return;
      }
      const deb = {
        nome: mensalDeb.nome,
        documento: mensalDeb.documento,
        email: mensalDeb.email,
        telefone: mensalDeb.telefone,
      };
      if (formato === "xlsx") {
        gerarRelatorioMensalXlsx(deb, vendas as any, mensalAno, mensalMes, retiradas as any);
      } else {
        gerarRelatorioMensal(deb, vendas as any, mensalAno, mensalMes, retiradas as any);
      }
      setMensalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar relatório mensal");
    } finally {
      setGerandoMensal(false);
    }
  };

  const gerarBulkMensal = async (formato: "pdf" | "xlsx" = "pdf") => {
    const ativos = list.filter((d: any) => (d.status ?? "ativo") === "ativo");
    if (ativos.length === 0) {
      toast.warning("Nenhum debenturista PF ativo");
      return;
    }
    setBulkProgress({ done: 0, total: ativos.length });
    try {
      const zip = new JSZip();
      let incluidos = 0;
      for (let i = 0; i < ativos.length; i++) {
        const d = ativos[i];
        try {
          const [{ data: vendas }, { data: retiradas }] = await Promise.all([
            supabase
              .from("vendas_debenture")
              .select("id, valor, data_venda, debenture:debenture_id(nome,rentabilidade_anual,tipo_taxa,data_vencimento)")
              .eq("debenturista_id", d.id)
              .order("data_venda", { ascending: true }),
            supabase
              .from("retiradas_debenture")
              .select("venda_id, data_retirada, tipo, valor_retirado, rendimento_bruto, valor_ir_retido, rendimento_liquido")
              .eq("debenturista_id", d.id)
              .order("data_retirada", { ascending: true }),
          ]);
          if (vendas && vendas.length > 0) {
            if (formato === "xlsx") {
              const { wb, filename } = buildRelatorioMensalXlsx(
                { nome: d.nome, documento: d.documento, email: d.email, telefone: d.telefone },
                vendas as any,
                bulkAno,
                bulkMes,
                (retiradas ?? []) as any
              );
              const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
              zip.file(filename, buf);
            } else {
              const { doc, filename } = buildRelatorioMensal(
                { nome: d.nome, documento: d.documento, email: d.email, telefone: d.telefone },
                vendas as any,
                bulkAno,
                bulkMes,
                (retiradas ?? []) as any
              );
              zip.file(filename, doc.output("arraybuffer"));
            }
            incluidos++;
          }
        } catch (e) {
          console.error("Falha ao gerar para", d.nome, e);
        }
        setBulkProgress({ done: i + 1, total: ativos.length });
      }
      if (incluidos === 0) {
        toast.warning("Nenhum debenturista possui investimentos para o período");
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorios-mensais-${formato}-${String(bulkMes).padStart(2, "0")}-${bulkAno}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${incluidos} relatório(s) gerado(s)`);
      setBulkOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao gerar relatórios em lote");
    } finally {
      setBulkProgress(null);
    }
  };


  const totalAtivos = list.filter((d: any) => (d.status ?? "ativo") === "ativo").length;
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const anosOpt = Array.from({ length: 6 }, (_, i) => hojeRef.getFullYear() - i);


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t("debenturistas.title")}</h1>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{t("debenturistas.actives")}</span>
            <span className="text-base font-semibold">{totalAtivos}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <CalendarRange className="mr-1 h-4 w-4" /> Relatórios mensais (todos)
          </Button>
          <Button asChild><Link to="/clientes/debenturistas/novo"><Plus className="mr-1 h-4 w-4" /> {t("debenturistas.new")}</Link></Button>
        </div>

      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("debenturistas.search")} className="h-8 pl-8 text-xs" />
      </div>

      <Card className="overflow-hidden border-border/60 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th 
                  className="px-4 py-2 min-w-[250px] text-left font-medium cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => toggleSort("nome")}
                >
                  <div className="flex items-center gap-1">
                    {t("debenturistas.colName")}
                    <SortIcon k="nome" />
                  </div>
                </th>
                <th className="px-4 py-2 text-center font-medium">{t("debenturistas.colCpf")}</th>
                <th className="px-4 py-2 text-center font-medium">{t("debenturistas.colEmail")}</th>
                <th className="px-2 py-2 text-center font-medium">{t("debenturistas.colPhone")}</th>
                <th className="px-4 py-2 text-center font-medium">{t("debenturistas.colStatus")}</th>
                <th className="sticky right-0 z-10 bg-muted px-2 py-2 w-[1%] whitespace-nowrap text-center font-medium">{t("debenturistas.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d: any) => {
                const status = (d.status ?? "ativo") as "ativo" | "suspenso" | "cancelado";
                const variant = status === "ativo" ? "default" : status === "suspenso" ? "secondary" : "destructive";
                return (
                <tr key={d.id} className="group border-t border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-2 min-w-[250px] font-medium">{d.nome}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{d.documento || "-"}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{d.email || "-"}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground whitespace-nowrap">{d.telefone ? maskPhone(d.telefone) : "-"}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={variant as any} className="text-[10px] capitalize">{status}</Badge>
                  </td>
                  <td className="sticky right-0 z-10 bg-card px-2 py-2 w-[1%] whitespace-nowrap group-hover:bg-muted/30">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                        title="Inativar"
                        onClick={() => handleStatus(d.id, "suspenso")}
                      >
                        <Ban className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => handleDelete(d.id, d.nome)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title={t("debenturistas.consolidatedReport")}
                        disabled={gerandoId === d.id}
                        onClick={() => gerarRelatorioConsolidado(d)}
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Relatório mensal"
                        onClick={() => abrirMensal(d)}
                      >
                        <CalendarRange className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Termo de investimento (PDF)"
                        onClick={() => gerarTermo(d.id)}
                      >
                        <FileSignature className="h-3 w-3" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className={`h-7 gap-1 px-1.5 ${d.termo_assinado_path ? "text-primary hover:text-white dark:hover:text-white" : ""}`}>
                            <LinkIcon className="h-3 w-3" />
                            <span className="text-[10px]">{d.termo_assinado_path ? "Termo" : "Anexar"}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {d.termo_assinado_path && (
                            <DropdownMenuItem onClick={() => handleViewTermo(d.termo_assinado_path, d.nome)}>
                              <Eye className="mr-2 h-3.5 w-3.5" /> {t("debenturistas.viewSignedTerm")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => document.getElementById(`upload-${d.id}`)?.click()}>
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            {d.termo_assinado_path ? "Substituir termo" : t("debenturistas.attachSignedTerm")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <input
                        id={`upload-${d.id}`}
                        type="file"
                        className="hidden"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(d.id, file);
                        }}
                      />

                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => nav(`/clientes/debenturistas/${d.id}`)}><Pencil className="h-3 w-3" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] uppercase font-bold tracking-tight">{t("debenturistas.statusMenu")}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-0 shadow-none ring-0">
                          <DropdownMenuItem onClick={() => handleStatus(d.id, "ativo")}>{t("debenturistas.statusActivate")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(d.id, "suspenso")}>
                            <Ban className="mr-2 h-3.5 w-3.5" /> Inativar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatus(d.id, "cancelado")} className="text-destructive">{t("debenturistas.statusCancel")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );})}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">{t("debenturistas.none")}</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={mensalOpen} onOpenChange={setMensalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório mensal</DialogTitle>
            <DialogDescription>
              {mensalDeb?.nome ? `Cliente: ${mensalDeb.nome}` : "Selecione o período"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select value={String(mensalMes)} onValueChange={(v) => setMensalMes(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Select value={String(mensalAno)} onValueChange={(v) => setMensalAno(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosOpt.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMensalOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => confirmarMensal("xlsx")} disabled={gerandoMensal}>
              {gerandoMensal ? "Gerando..." : "Baixar XLSX"}
            </Button>
            <Button onClick={() => confirmarMensal("pdf")} disabled={gerandoMensal}>
              {gerandoMensal ? "Gerando..." : "Gerar PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkProgress && setBulkOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relatórios mensais — todos PF ativos</DialogTitle>
            <DialogDescription>
              Gera um ZIP com o PDF de cada debenturista PF ativo para o período.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Mês</Label>
              <Select value={String(bulkMes)} onValueChange={(v) => setBulkMes(Number(v))} disabled={!!bulkProgress}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ano</Label>
              <Select value={String(bulkAno)} onValueChange={(v) => setBulkAno(Number(v))} disabled={!!bulkProgress}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anosOpt.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {bulkProgress && (
            <div className="text-xs text-muted-foreground">
              Processando {bulkProgress.done} de {bulkProgress.total}...
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={!!bulkProgress}>Cancelar</Button>
            <Button variant="secondary" onClick={() => gerarBulkMensal("xlsx")} disabled={!!bulkProgress}>
              {bulkProgress ? "Gerando..." : "ZIP de XLSX"}
            </Button>
            <Button onClick={() => gerarBulkMensal("pdf")} disabled={!!bulkProgress}>
              {bulkProgress ? "Gerando..." : "ZIP de PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingTermo} onOpenChange={(open) => !open && setViewingTermo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-base font-medium">Visualização do Termo Assinado</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-4 bg-muted/30">
            {viewingTermo && (
              <PdfViewer url={viewingTermo.url} fileName={viewingTermo.fileName} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente excluir esse registro ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

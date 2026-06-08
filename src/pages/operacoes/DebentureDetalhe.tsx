import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronRight, Upload, FileText, AlertTriangle, Wallet, TrendingUp, Banknote, Paperclip, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown, ScrollText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";
import { useFeriados, diasUteis as diasUteisFn, proximoDiaUtil, type FeriadosSet } from "@/lib/diasUteis";
import {
  calcRendimento,
  calcLiquido,
  calcRendDiario,
  type CalcOpts,
  type CdiMap,
} from "@/lib/rendimento";
import { useAuth } from "@/hooks/useAuth";
import { PdfViewer } from "@/components/PdfViewer";
import { gerarCautelaPDF } from "@/lib/cautela";
import jhlLogo from "@/assets/jhl-logo.png";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

const situacaoColor: Record<string, string> = {
  disponivel: "bg-primary/10 text-primary border-primary/20",
  vendida: "bg-success/10 text-success border-success/20",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export default function DebentureDetalhe() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) => Number(n || 0).toLocaleString(locale, { style: "currency", currency: "BRL" });
  const fmtDate = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString(locale) : "-");
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [openVenda, setOpenVenda] = useState(false);
  const [openInfo, setOpenInfo] = useState(false);
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovanteTipo, setComprovanteTipo] = useState<"pdf" | "image" | "other">("other");
  const [syncingCdi, setSyncingCdi] = useState(false);
  const { data: feriados } = useFeriados();
  const diasUteis = (from: string, to: Date = new Date()) => diasUteisFn(from, to, feriados);

  const { data: deb } = useQuery({
    queryKey: ["debenture", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("debentures").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: cotas = [] } = useQuery({
    queryKey: ["cotas", id],
    queryFn: async () => {
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("cotas_debenture")
          .select("*")
          .eq("debenture_id", id)
          .order("numero", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = data ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },
    enabled: !!id,
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_debenture")
        .select("*, comprovante_path, cota:cota_id(numero), debenturista:debenturista_id(nome,tipo), caixa:caixa_id(nome)")
        .eq("debenture_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: caixas = [] } = useQuery({
    queryKey: ["caixas-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("caixas").select("id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });


  const isCDI = (deb?.tipo_taxa ?? "FIXA") === "CDI";

  // Dispara sync da série CDI quando a debênture for do tipo CDI
  useEffect(() => {
    if (!isCDI) return;
    supabase.functions.invoke("sync-cdi").then(({ error }) => {
      if (error) console.warn("sync-cdi:", error.message);
      else qc.invalidateQueries({ queryKey: ["cdi-diario"] });
    });
  }, [isCDI, qc]);

  const { data: cdiRows = [] } = useQuery({
    queryKey: ["cdi-diario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdi_diario")
        .select("data,taxa")
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: isCDI,
  });

  const cdiMap = useMemo<CdiMap>(() => {
    const m = new Map<string, number>();
    cdiRows.forEach((r: any) => m.set(r.data, Number(r.taxa)));
    return m;
  }, [cdiRows]);

  const calcOpts: CalcOpts = useMemo(
    () => ({ tipoTaxa: deb?.tipo_taxa, cdi: cdiMap, feriados }),
    [deb?.tipo_taxa, cdiMap, feriados]
  );

  // Detecta CDI desatualizado (última taxa publicada > 2 dias úteis atrás)
  const cdiStale = useMemo(() => {
    if (!isCDI || cdiRows.length === 0) return null;
    const lastIso = (cdiRows[cdiRows.length - 1] as any).data as string;
    const du = diasUteis(lastIso, new Date());
    return du > 2 ? { lastIso, du } : null;
  }, [isCDI, cdiRows]);


  const { data: emissores = {} as Record<string, string> } = useQuery({
    queryKey: ["emissores", id],
    queryFn: async () => {
      const ids = Array.from(new Set(cotas.map((c: any) => c.emitida_por).filter(Boolean)));
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => (map[p.id] = p.full_name || p.email || ""));
      return map;
    },
    enabled: cotas.length > 0,
  });

  const disponiveis = useMemo(() => cotas.filter((c: any) => c.situacao === "disponivel"), [cotas]);
  const vendidas = useMemo(() => cotas.filter((c: any) => c.situacao === "vendida"), [cotas]);

  const resumoDebenturistas = useMemo(() => {
    const rentAnual = Number(deb?.rentabilidade_anual ?? 0);
    const map = new Map<string, { id: string; nome: string; tipo?: string; qtd: number; total: number; rendimento: number; rendimentoLiquido: number }>();
    vendas.forEach((v: any) => {
      const id = v.debenturista_id || v.debenturista?.id || "desconhecido";
      const existing = map.get(id) || { id, nome: v.debenturista?.nome || "—", tipo: v.debenturista?.tipo, qtd: 0, total: 0, rendimento: 0, rendimentoLiquido: 0 };
      const dataVenda = v.data_venda || v.created_at?.slice(0, 10);
      const du = diasUteis(dataVenda);
      const valor = Number(v.valor || 0);
      const rendBruto = calcRendimento(valor, rentAnual, du, { ...calcOpts, dataVenda });
      existing.qtd += 1;
      existing.total += valor;
      existing.rendimento += rendBruto;
      existing.rendimentoLiquido += calcLiquido(rendBruto, dataVenda);
      map.set(id, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
  }, [vendas, deb, calcOpts]);

  const PAGE_SIZE = 10;
  const [pageDisp, setPageDisp] = useState(1);
  const [pageVend, setPageVend] = useState(1);
  const totalPagesDisp = Math.max(1, Math.ceil(disponiveis.length / PAGE_SIZE));
  const totalPagesVend = Math.max(1, Math.ceil(vendas.length / PAGE_SIZE));
  const disponiveisPag = useMemo(
    () => disponiveis.slice((pageDisp - 1) * PAGE_SIZE, pageDisp * PAGE_SIZE),
    [disponiveis, pageDisp]
  );
  // Agrupa por EVENTO de compra (mesma transação de insert => mesmo created_at),
  // mantendo separadas compras distintas do mesmo cliente mesmo no mesmo dia.
  const vendasAgrupadas = useMemo(() => {
    const map = new Map<string, any>();
    vendas.forEach((v: any) => {
      const dv = v.data_venda || v.created_at?.slice(0, 10);
      const evento = v.created_at || v.id;
      const key = `${v.debenturista_id || v.debenturista?.id || "-"}|${evento}`;
      const ex = map.get(key);
      if (ex) {
        ex.valor += Number(v.valor || 0);
        ex.vendaIds.push(v.id);
        ex.cotaIds.push(v.cota_id);
        if (v.cota?.numero != null) ex.cotas.push(v.cota.numero);
      } else {
        map.set(key, {
          id: v.id,
          vendaIds: [v.id],
          cotaIds: [v.cota_id],
          data_venda: dv,
          created_at: v.created_at,
          debenturista_id: v.debenturista_id,
          caixa_id: v.caixa_id,
          debenturista: v.debenturista,
          caixa: v.caixa,
          valor: Number(v.valor || 0),
          cotas: v.cota?.numero != null ? [v.cota.numero] : [],
          comprovante_path: v.comprovante_path || null,
        });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => (b.created_at || b.data_venda || "").localeCompare(a.created_at || a.data_venda || "")
    );
  }, [vendas]);
  const [sortVendKey, setSortVendKey] = useState<string | null>(null);
  const [sortVendDir, setSortVendDir] = useState<"asc" | "desc">("asc");
  const toggleSortVend = (k: string) => {
    if (sortVendKey === k) setSortVendDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortVendKey(k); setSortVendDir("asc"); }
  };
  const vendasAgrupadasSorted = useMemo(() => {
    if (!sortVendKey || !deb) return vendasAgrupadas;
    const rentAnual = Number(deb.rentabilidade_anual ?? 0);
    const valOf = (v: any) => {
      const du = diasUteis(v.data_venda);
      const valor = Number(v.valor || 0);
      const opts = { ...calcOpts, dataVenda: v.data_venda };
      switch (sortVendKey) {
        case "numero": return (v.cotas || []).length;
        case "cliente": return String(v.debenturista?.nome ?? "").toLowerCase();
        case "caixa": return String(v.caixa?.nome ?? "").toLowerCase();
        case "valor": return valor;
        case "data": return v.data_venda ? new Date(v.data_venda).getTime() : 0;
        case "diasUteis": return du;
        case "rendDiario": return calcRendDiario(valor, rentAnual, opts);
        case "percEvol": {
          const ra = calcRendimento(valor, rentAnual, du, opts);
          return valor > 0 ? (ra / valor) : 0;
        }
        case "rendAcum": return calcRendimento(valor, rentAnual, du, opts);
        case "rendLiq": return calcLiquido(calcRendimento(valor, rentAnual, du, opts), v.data_venda);
        default: return 0;
      }
    };
    const arr = [...vendasAgrupadas];
    arr.sort((a, b) => {
      const va = valOf(a); const vb = valOf(b);
      if (va < vb) return sortVendDir === "asc" ? -1 : 1;
      if (va > vb) return sortVendDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [vendasAgrupadas, sortVendKey, sortVendDir, deb, calcOpts]);
  const totalPagesVendAgr = Math.max(1, Math.ceil(vendasAgrupadasSorted.length / PAGE_SIZE));
  const vendasPag = useMemo(
    () => vendasAgrupadasSorted.slice((pageVend - 1) * PAGE_SIZE, pageVend * PAGE_SIZE),
    [vendasAgrupadasSorted, pageVend]
  );

  // Lista de debenturistas cadastrados
  const { data: debenturistas = [] } = useQuery({
    queryKey: ["debenturistas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debenturistas")
        .select("id,nome,documento,tipo,status")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Form da venda
  const [debenturistaId, setDebenturistaId] = useState<string>("");
  const [caixaId, setCaixaId] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [modoEntrada, setModoEntrada] = useState<"cotas" | "valor">("cotas");
  const [valorEntrada, setValorEntrada] = useState<string>("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const valorTotalVenda = Number(deb?.valor_cota || 0) * (quantidade || 0);

  const resetForm = () => {
    setDebenturistaId("");
    setCaixaId("");
    setQuantidade(1);
    setModoEntrada("cotas");
    setValorEntrada("");
    setComprovante(null);
  };

  const handleEnviarVenda = async () => {
    if (!deb) return;
    if (!debenturistaId) return toast.error(t("debentureDetalhe.selectDebenturistaErr"));
    if (!caixaId) return toast.error(t("debentureDetalhe.selectCaixaErr"));
    if (!quantidade || quantidade < 1) return toast.error(t("debentureDetalhe.quantityErr"));
    if (disponiveis.length === 0) return toast.error(t("debentureDetalhe.noCotasErr"));
    if (quantidade > disponiveis.length) return toast.error(t("debentureDetalhe.onlyAvailable", { n: disponiveis.length }));

    setSalvando(true);
    try {
      // upload comprovante
      let comprovantePath: string | null = null;
      if (comprovante) {
        const ext = comprovante.name.split(".").pop();
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: errUp } = await supabase.storage.from("comprovantes-vendas").upload(path, comprovante);
        if (errUp) throw errUp;
        comprovantePath = path;
      }

      // registra venda nas próximas N cotas disponíveis
      const cotasSelecionadas = disponiveis.slice(0, quantidade);
      const valorCota = Number(deb.valor_cota || 0);
      const hojeIso = new Date().toISOString().slice(0, 10);
      const dataVendaEfetiva = proximoDiaUtil(hojeIso, feriados);
      const ajustada = dataVendaEfetiva !== hojeIso;
      const rows = cotasSelecionadas.map((c: any) => ({
        debenture_id: id,
        cota_id: c.id,
        debenturista_id: debenturistaId,
        caixa_id: caixaId,
        valor: valorCota,
        comprovante_path: comprovantePath,
        data_venda: dataVendaEfetiva,
      }));
      const { error: errVenda } = await supabase.from("vendas_debenture").insert(rows);
      if (errVenda) throw errVenda;

      const totalInvestido = valorCota * cotasSelecionadas.length;
      toast.success(t("debentureDetalhe.saleSuccess", { n: cotasSelecionadas.length, total: fmt(totalInvestido) }));
      if (ajustada) {
        toast.info(t("debentureDetalhe.saleDateAdjusted", { date: new Date(dataVendaEfetiva + "T00:00:00").toLocaleDateString() }));
      }
      toast.info(t("debentureDetalhe.welcomeEmailQueued"));
      toast.info(t("debentureDetalhe.welcomeEmailQueued"));

      // Fire-and-forget: notifica N8N (e-mail de boas-vindas)
      supabase.functions
        .invoke("notify-debenture-acquired", {
          body: {
            debenture_id: id,
            debenturista_id: debenturistaId,
            quantidade_cotas: cotasSelecionadas.length,
            valor_investido: totalInvestido,
          },
        })
        .catch((err) => console.error("notify-debenture-acquired falhou", err));

      qc.invalidateQueries({ queryKey: ["cotas", id] });
      qc.invalidateQueries({ queryKey: ["vendas", id] });
      resetForm();
      setOpenVenda(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("debentureDetalhe.saleError"));
    } finally {
      setSalvando(false);
    }
  };

  const abrirComprovante = async (path?: string | null) => {
    if (!path) return toast.error(t("debentureDetalhe.noReceipt", { defaultValue: "Sem comprovante anexado" }));
    const { data, error } = await supabase.storage
      .from("comprovantes-vendas")
      .download(path);
    if (error || !data) {
      return toast.error(error?.message || "Erro ao abrir comprovante");
    }
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mime =
      ext === "pdf" ? "application/pdf" :
      ext === "png" ? "image/png" :
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" :
      data.type || "application/octet-stream";
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    setComprovanteTipo(
      ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image" : "other"
    );
    if (comprovanteUrl) URL.revokeObjectURL(comprovanteUrl);
    setComprovanteUrl(url);
  };

  // Edição/exclusão de venda agrupada (apenas admin)
  const [editVenda, setEditVenda] = useState<any | null>(null);
  const [editData, setEditData] = useState<string>("");
  const [editCaixaId, setEditCaixaId] = useState<string>("");
  const [editDebenturistaId, setEditDebenturistaId] = useState<string>("");
  const [editComprovante, setEditComprovante] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmExcluirVenda, setConfirmExcluirVenda] = useState<any | null>(null);

  const abrirEdicaoVenda = (v: any) => {
    setEditVenda(v);
    setEditData(v.data_venda || "");
    setEditCaixaId(v.caixa_id || "");
    setEditDebenturistaId(v.debenturista_id || "");
    setEditComprovante(null);
  };

  const salvarEdicaoVenda = async () => {
    if (!editVenda) return;
    setSavingEdit(true);
    try {
      const update: any = {
        data_venda: editData,
        caixa_id: editCaixaId || null,
        debenturista_id: editDebenturistaId || null,
      };
      if (editComprovante) {
        const ext = editComprovante.name.split(".").pop();
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: errUp } = await supabase.storage
          .from("comprovantes-vendas")
          .upload(path, editComprovante);
        if (errUp) throw errUp;
        update.comprovante_path = path;
      }
      const { error } = await supabase
        .from("vendas_debenture")
        .update(update)
        .in("id", editVenda.vendaIds);
      if (error) throw error;
      toast.success("Venda atualizada");
      qc.invalidateQueries({ queryKey: ["vendas", id] });
      setEditVenda(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    } finally {
      setSavingEdit(false);
    }
  };

  const excluirVenda = async (v: any) => {
    try {
      const { error: errDel } = await supabase
        .from("vendas_debenture")
        .delete()
        .in("id", v.vendaIds);
      if (errDel) throw errDel;
      const cotaIds = (v.cotaIds || []).filter(Boolean);
      if (cotaIds.length > 0) {
        const { error: errCot } = await supabase
          .from("cotas_debenture")
          .update({ situacao: "disponivel", updated_at: new Date().toISOString() })
          .in("id", cotaIds);
        if (errCot) throw errCot;
      }
      toast.success("Venda excluída");
      qc.invalidateQueries({ queryKey: ["vendas", id] });
      qc.invalidateQueries({ queryKey: ["cotas", id] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };


  const gerarRelatorioPDF = () => {
    if (!deb) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const rentAnual = Number(deb.rentabilidade_anual ?? 0);
    const valorCota = Number(deb.valor_cota || 0);

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
    doc.text("Relatório de Debênture", 14, 19);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(deb.nome, 14, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `${deb.emissao ? "Emissão " + deb.emissao : ""}${deb.serie ? " · Série " + deb.serie : ""}`,
      14,
      46
    );
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 52,
      head: [["Dados da Debênture", "Valor"]],
      body: [
        ["Valor total", fmt(Number(deb.valor || 0))],
        ["Valor da cota", fmt(valorCota)],
        ["Quantidade de cotas", String(deb.quantidade_cotas ?? 0)],
        ["Taxa", `${Number(deb.taxa ?? 0).toFixed(2)}% ${deb.tipo_taxa ?? ""}`],
        ["Rentabilidade anual", `${rentAnual.toFixed(2)}%`],
        ["Tipo de retirada", deb.tipo_retirada || "-"],
        ["Data início", fmtDate(deb.data_inicio)],
        ["Data vencimento", fmtDate(deb.data_vencimento)],
        ["Final de vendas", fmtDate(deb.data_final_vendas)],
        ["Duração (meses)", String(deb.duracao_meses ?? "-")],
        ["Status", String(deb.status)],
        ["Cotas disponíveis", String(disponiveis.length)],
        ["Cotas vendidas", String(vendidas.length)],
        ["Total arrecadado", fmt(vendidas.length * valorCota)],
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [25, 45, 77], textColor: 255 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    const pctFmt = (n: number, base: number) =>
      base > 0 ? `${((n / base) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-";

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["#", "Cota", "Debenturista", "Caixa", "Valor", "Data Venda", "Dias Úteis", "Rend. Bruto", "Rend. Líquido", "% Evol."]],
      body: [...vendas]
        .sort((a: any, b: any) => Number(b.cota?.numero ?? 0) - Number(a.cota?.numero ?? 0))
        .map((v: any, i: number) => {
        const dataVenda = v.data_venda || v.created_at?.slice(0, 10);
        const du = diasUteis(dataVenda);
        const valor = Number(v.valor || 0);
        const rendAcum = calcRendimento(valor, rentAnual, du, { ...calcOpts, dataVenda });
        const rendLiq = calcLiquido(rendAcum, dataVenda);
        return [
          String(i + 1),
          String(v.cota?.numero ?? "-"),
          v.debenturista?.nome ?? "-",
          v.caixa?.nome ?? "-",
          fmt(valor),
          fmtDate(dataVenda),
          String(du),
          fmt(rendAcum),
          fmt(rendLiq),
          pctFmt(rendAcum, valor),
        ];
      }),
      foot: [(() => {
        const totalValor = vendas.reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
        let totalRend = 0;
        let totalLiq = 0;
        vendas.forEach((v: any) => {
          const dataVenda = v.data_venda || v.created_at?.slice(0, 10);
          const du = diasUteis(dataVenda);
          const r = calcRendimento(Number(v.valor || 0), rentAnual, du, { ...calcOpts, dataVenda });
          totalRend += r;
          totalLiq += calcLiquido(r, dataVenda);
        });
        return [
          { content: "Total", colSpan: 4, styles: { halign: "center" } },
          fmt(totalValor),
          "",
          "",
          fmt(totalRend),
          fmt(totalLiq),
          pctFmt(totalRend, totalValor),
        ];
      })()],
      showFoot: "lastPage",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [25, 45, 77], textColor: 255, halign: "center" },
      footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { halign: "center", cellWidth: 8 }, 4: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center" }, 8: { halign: "center" }, 9: { halign: "center" } },
      didParseCell: (data: any) => {
        if ((data.column.index === 7 || data.column.index === 8 || data.column.index === 9) && (data.section === "body" || data.section === "foot")) {
          data.cell.styles.textColor = [22, 163, 74];
        }
      },

      didDrawPage: () => {
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, h - 8);
      },
    });

    previewPdf(doc, `debenture_${deb.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const rendimentoAcumuladoTotal = useMemo(() => {
    const rentAnual = Number(deb?.rentabilidade_anual ?? 0);
    return vendas.reduce((s: number, v: any) => {
      const du = diasUteis(v.data_venda || v.created_at?.slice(0, 10));
      return s + calcRendimento(Number(v.valor || 0), rentAnual, du, { ...calcOpts, dataVenda: v.data_venda || v.created_at?.slice(0, 10) });
    }, 0);
  }, [vendas, deb, calcOpts]);

  const rendimentoLiquidoTotal = useMemo(
    () => resumoDebenturistas.reduce((s, r) => s + r.rendimentoLiquido, 0),
    [resumoDebenturistas]
  );

  const gerarRelatorioInfo = () => {
    if (!deb) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const valorCota = Number(deb.valor_cota || 0);

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
    doc.text("Informações Detalhadas da Debênture", 14, 19);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(deb.nome, 14, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `${deb.emissao ? "Emissão " + deb.emissao : ""}${deb.serie ? " · Série " + deb.serie : ""}`,
      14,
      46
    );
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 52,
      head: [["Campo", "Valor"]],
      body: [
        ["Nome", deb.nome],
        ["Emissão", deb.emissao || "-"],
        ["Série", deb.serie || "-"],
        ["Valor total", fmt(Number(deb.valor || 0))],
        ["Valor da cota", fmt(valorCota)],
        ["Quantidade de cotas", String(deb.quantidade_cotas ?? 0)],
        ["Taxa", `${Number(deb.taxa ?? 0).toFixed(2)}% ${deb.tipo_taxa ?? ""}`],
        ["Rentabilidade anual", `${Number(deb.rentabilidade_anual ?? 0).toFixed(2)}%`],
        ["Tipo de retirada", deb.tipo_retirada || "-"],
        ["Data início", fmtDate(deb.data_inicio)],
        ["Data vencimento", fmtDate(deb.data_vencimento)],
        ["Final de vendas", fmtDate(deb.data_final_vendas)],
        ["Duração (meses)", String(deb.duracao_meses ?? "-")],
        ["Status", String(deb.status)],
        ["Cotas disponíveis", String(disponiveis.length)],
        ["Cotas vendidas", String(vendidas.length)],
        ["Total arrecadado", fmt(vendidas.length * valorCota)],
        ["Rendimento acumulado (bruto)", fmt(rendimentoAcumuladoTotal)],
        ["Rendimento líquido (IR regressivo)", fmt(rendimentoLiquidoTotal)],
        ...(deb.observacoes ? [["Observações", String(deb.observacoes)]] : []),
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [25, 45, 77], textColor: 255 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    const pctFmt = (n: number, base: number) =>
      base > 0 ? `${((n / base) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-";
    const totalArrecadado = vendidas.length * valorCota;

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [[`Debenturistas (${resumoDebenturistas.length})`, "Cotas", "Valor Total", "Rend. Bruto", "Rend. Líquido", "% Evol."]],
      body: resumoDebenturistas.length === 0
        ? [["Nenhuma cota adquirida ainda", "", "", "", "", ""]]
        : resumoDebenturistas.map((r) => [
            `${r.nome}${r.tipo ? ` (${r.tipo})` : ""}`,
            String(r.qtd),
            fmt(r.total),
            fmt(r.rendimento),
            fmt(r.rendimentoLiquido),
            pctFmt(r.rendimento, r.total),
          ]),
      foot: [["Total", String(vendidas.length), fmt(totalArrecadado), fmt(rendimentoAcumuladoTotal), fmt(rendimentoLiquidoTotal), pctFmt(rendimentoAcumuladoTotal, totalArrecadado)]],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [25, 45, 77], textColor: 255, halign: "center" },
      footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
      didParseCell: (data: any) => {
        if ((data.column.index === 3 || data.column.index === 4 || data.column.index === 5) && (data.section === "body" || data.section === "foot")) {
          data.cell.styles.textColor = [22, 163, 74];
        }
      },

      didDrawPage: () => {
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, h - 8);
      },
    });

    previewPdf(doc, `debenture_info_${deb.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (!deb) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/operacoes/debentures" className="hover:text-foreground">{t("debentureDetalhe.crumbList")}</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{t("debentureDetalhe.crumbEdit")}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{deb.nome}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {deb.emissao && `Emissão ${deb.emissao}`} {deb.serie && `· Série ${deb.serie}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gerarRelatorioPDF()}>
            <FileText className="h-4 w-4" /> {t("debentureDetalhe.generatePdf")}
          </Button>
          <Dialog open={openInfo} onOpenChange={setOpenInfo}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">{t("debentureDetalhe.detailedInfo")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between gap-4 pr-8">
                  <DialogTitle>{t("debentureDetalhe.detailedInfoTitle")} — {deb.nome}</DialogTitle>
                  <Button variant="outline" size="sm" onClick={gerarRelatorioInfo}>
                    <FileText className="h-4 w-4" /> {t("debentureDetalhe.generatePdf")}
                  </Button>
                </div>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("debentureDetalhe.debentureData")}</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
                    <Info label={t("fields.name")} value={deb.nome} />
                    <Info label={t("debentures.emissao")} value={deb.emissao || "-"} />
                    <Info label={t("fields.series")} value={deb.serie || "-"} />
                    <Info label={t("debentureDetalhe.valorTotal")} value={fmt(Number(deb.valor || 0))} />
                    <Info label={t("debentureDetalhe.valorCota")} value={fmt(Number(deb.valor_cota || 0))} />
                    <Info label={t("debentureDetalhe.quantidadeCotas")} value={String(deb.quantidade_cotas ?? 0)} />
                    <Info label={t("debentureDetalhe.taxa")} value={`${Number(deb.taxa ?? 0).toFixed(2)}% ${deb.tipo_taxa}`} />
                    <Info label={t("debentureDetalhe.rentabilidadeAnual")} value={`${Number(deb.rentabilidade_anual ?? 0).toFixed(2)}%`} />
                    <Info label={t("debentureDetalhe.tipoRetirada")} value={deb.tipo_retirada || "-"} />
                    <Info label={t("debentureDetalhe.dataInicio")} value={fmtDate(deb.data_inicio)} />
                    <Info label={t("debentureDetalhe.dataVencimento")} value={fmtDate(deb.data_vencimento)} />
                    <Info label={t("debentureDetalhe.finalVendas")} value={fmtDate(deb.data_final_vendas)} />
                    <Info label={t("debentureDetalhe.duracaoMeses")} value={String(deb.duracao_meses ?? "-")} />
                    <Info label={t("debentureDetalhe.status")} value={String(deb.status)} />
                    <Info label={t("debentureDetalhe.cotasDisponiveis")} value={String(disponiveis.length)} />
                    <Info label={t("debentureDetalhe.cotasVendidas")} value={String(vendidas.length)} />
                    <Info label={t("debentureDetalhe.totalArrecadado")} value={fmt(vendidas.length * Number(deb.valor_cota || 0))} />
                    <Info label={t("debentureDetalhe.rendimentoAcumulado")} value={fmt(rendimentoAcumuladoTotal)} />
                    <Info label={t("debentureDetalhe.rendimentoLiquido")} value={fmt(rendimentoLiquidoTotal)} />
                  </div>
                  {deb.observacoes && (
                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("debentureDetalhe.observations")}</div>
                      <div className="mt-1 text-xs text-foreground">{deb.observacoes}</div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("debentureDetalhe.debenturistas")} ({resumoDebenturistas.length})
                  </h4>
                  {resumoDebenturistas.length === 0 ? (
                    <div className="rounded-md border border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("debentureDetalhe.noCotasAcquired")}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border/60">
                      <table className="w-full text-xs">
                        <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">{t("debentureDetalhe.colNome")}</th>
                            <th className="px-4 py-2 text-center font-medium">{t("debentureDetalhe.colCotas")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("debentureDetalhe.colValorTotal")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("debentureDetalhe.colRendAcum")}</th>
                            <th className="px-4 py-2 text-right font-medium">{t("debentureDetalhe.colRendLiquido")}</th>
                            <th className="px-4 py-2 text-right font-medium">% Evol.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumoDebenturistas.map((r) => (
                            <tr key={r.id} className="border-b border-border/60 last:border-0">
                              <td className="px-4 py-2 text-foreground">
                                {r.nome} {r.tipo && <span className="text-[10px] uppercase text-muted-foreground">({r.tipo})</span>}
                              </td>
                              <td className="px-4 py-2 text-center font-medium">{r.qtd}</td>
                              <td className="px-4 py-2 text-right font-medium">{fmt(r.total)}</td>
                              <td className="px-4 py-2 text-right font-medium text-success">{fmt(r.rendimento)}</td>
                              <td className="px-4 py-2 text-right font-medium text-success">{fmt(r.rendimentoLiquido)}</td>
                              <td className="px-4 py-2 text-right font-medium text-success">
                                {r.total > 0 ? `${((r.rendimento / r.total) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-"}
                              </td>
                            </tr>
                          ))}
                          {(() => {
                            const totalArrec = vendidas.length * Number(deb.valor_cota || 0);
                            return (
                              <tr className="bg-muted/30 font-semibold">
                                <td className="px-4 py-2">{t("debentureDetalhe.total")}</td>
                                <td className="px-4 py-2 text-center">{vendidas.length}</td>
                                <td className="px-4 py-2 text-right">{fmt(totalArrec)}</td>
                                <td className="px-4 py-2 text-right text-success">{fmt(rendimentoAcumuladoTotal)}</td>
                                <td className="px-4 py-2 text-right text-success">{fmt(rendimentoLiquidoTotal)}</td>
                                <td className="px-4 py-2 text-right text-success">
                                  {totalArrec > 0 ? `${((rendimentoAcumuladoTotal / totalArrec) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-"}
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>

                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openVenda} onOpenChange={(v) => { if (deb?.status !== "ativo") return; setOpenVenda(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                disabled={deb?.status !== "ativo"}
                title={deb?.status !== "ativo" ? t("debentureDetalhe.saleBlocked", { status: deb?.status }) : undefined}
                className={deb?.status === "ativo"
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"}
              >
                {t("debentureDetalhe.registerSale")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{t("debentureDetalhe.registerSale")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>{t("debentureDetalhe.debenturista")} <span className="text-destructive">*</span></Label>
                  <Select value={debenturistaId} onValueChange={setDebenturistaId}>
                    <SelectTrigger><SelectValue placeholder={t("debentureDetalhe.selectDebenturista")} /></SelectTrigger>
                    <SelectContent>
                      {debenturistas.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {t("debentureDetalhe.noDebenturista")}
                        </div>
                      )}
                      {debenturistas.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome} {d.documento && <span className="text-[10px] text-muted-foreground">· {d.documento}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link to="/clientes/debenturistas/novo" className="text-[11px] text-primary hover:underline">{t("debentureDetalhe.addNew")}</Link>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("debentureDetalhe.caixa")} <span className="text-destructive">*</span></Label>
                    <Select value={caixaId} onValueChange={setCaixaId}>
                      <SelectTrigger><SelectValue placeholder={t("debentureDetalhe.selectCaixa")} /></SelectTrigger>
                      <SelectContent>
                        {caixas.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            {t("debentureDetalhe.noCaixa")}
                          </div>
                        )}
                        {caixas.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>
                        {modoEntrada === "cotas" ? t("debentureDetalhe.quantity") : t("debentureDetalhe.valorVenda")}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <div className="inline-flex overflow-hidden rounded-md border border-border text-[11px]">
                        <button
                          type="button"
                          onClick={() => setModoEntrada("cotas")}
                          className={`px-2 py-0.5 transition-colors ${modoEntrada === "cotas" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                          {t("debentureDetalhe.byCotas")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModoEntrada("valor");
                            const vc = Number(deb?.valor_cota || 0);
                            if (vc > 0) setValorEntrada((quantidade * vc).toFixed(2));
                          }}
                          className={`px-2 py-0.5 transition-colors ${modoEntrada === "valor" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                        >
                          {t("debentureDetalhe.byValor")}
                        </button>
                      </div>
                    </div>
                    {modoEntrada === "cotas" ? (
                      <Input
                        type="number"
                        min={1}
                        max={disponiveis.length || 1}
                        value={quantidade}
                        onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                      />
                    ) : (
                      <Input
                        type="number"
                        step="1000"
                        min={0}
                        value={valorEntrada}
                        onChange={(e) => {
                          setValorEntrada(e.target.value);
                          const v = Number(e.target.value) || 0;
                          const vc = Number(deb?.valor_cota || 0);
                          if (vc > 0) {
                            const q = Math.floor(v / vc);
                            const clamped = Math.max(1, Math.min(q || 1, disponiveis.length || 1));
                            setQuantidade(clamped);
                          }
                        }}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          const arredondado = Math.round(v / 1000) * 1000;
                          setValorEntrada(arredondado ? String(arredondado) : "");
                          const vc = Number(deb?.valor_cota || 0);
                          if (vc > 0 && arredondado > 0) {
                            const q = Math.floor(arredondado / vc);
                            const clamped = Math.max(1, Math.min(q || 1, disponiveis.length || 1));
                            setQuantidade(clamped);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {quantidade} × {fmt(Number(deb.valor_cota || 0))} · {disponiveis.length} {t("debentureDetalhe.available")}
                  </span>
                  <span className="font-semibold text-foreground">{t("debentureDetalhe.total")}: {fmt(valorTotalVenda)}</span>
                </div>

                <div className="grid gap-2">
                  <Label>{t("debentureDetalhe.proof")} <span className="text-destructive">*</span></Label>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted/30">
                    <Upload className="h-5 w-5" />
                    {comprovante ? comprovante.name : <span>{t("debentureDetalhe.dragOrClick")} <span className="text-primary">{t("debentureDetalhe.clickHere")}</span></span>}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button onClick={handleEnviarVenda} disabled={salvando} className="bg-success text-success-foreground hover:bg-success/90">
                  {salvando ? t("debentureDetalhe.sending") : t("debentureDetalhe.send")}
                </Button>
                <Button variant="outline" onClick={() => setOpenVenda(false)}>{t("common.cancel")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Destaques financeiros */}
      {(() => {
        const totalArrecadado = vendidas.length * Number(deb.valor_cota || 0);
        const totalBruto = totalArrecadado + rendimentoAcumuladoTotal;
        const totalLiquido = totalArrecadado + rendimentoLiquidoTotal;
        const items = [
          {
            icon: Wallet,
            label: t("debentureDetalhe.highlightValorTotal"),
            value: fmt(totalArrecadado),
            sub: `${vendidas.length} ${t("debentureDetalhe.colCotas")}`,
            accent: "text-primary",
          },
          {
            icon: TrendingUp,
            label: t("debentureDetalhe.highlightValorBruto"),
            value: fmt(totalBruto),
            sub: `+ ${fmt(rendimentoAcumuladoTotal)} ${t("debentureDetalhe.colRendAcum")}`,
            accent: "text-emerald-600",
          },
          {
            icon: Banknote,
            label: t("debentureDetalhe.highlightValorLiquido"),
            value: fmt(totalLiquido),
            sub: `+ ${fmt(rendimentoLiquidoTotal)} ${t("debentureDetalhe.colRendLiquido")}`,
            accent: "text-success",
          },
        ];
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="relative overflow-hidden rounded-xl border border-border py-3 px-4 shadow-sm"
                style={{
                  backgroundColor: isCDI ? "hsl(217 51% 95%)" : "hsl(142 71% 95%)",
                  borderLeftWidth: 4,
                  borderLeftColor: isCDI ? "hsl(217 51% 20%)" : "hsl(142 71% 45%)",
                  borderRightWidth: 4,
                  borderRightColor: isCDI ? "hsl(217 51% 20%)" : "hsl(142 71% 45%)",
                }}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: isCDI ? "hsl(217 51% 95%)" : "hsl(142 71% 95%)" }}
                  >
                    <item.icon className={`h-4 w-4 ${item.accent}`} />
                  </div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</div>
                  <div className={`text-base font-bold ${item.accent}`}>{item.value}</div>
                  <div className="text-[10px] text-muted-foreground">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {cdiStale && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("debentureDetalhe.cdiStaleTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("debentureDetalhe.cdiStaleDesc", { data: fmtDate(cdiStale.lastIso), du: cdiStale.du })}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={syncingCdi}
              onClick={async () => {
                setSyncingCdi(true);
                try {
                  const { error } = await supabase.functions.invoke("sync-cdi");
                  if (error) throw error;
                  await qc.invalidateQueries({ queryKey: ["cdi_diario"] });
                  toast.success(t("debentureDetalhe.cdiSyncSuccess"));
                } catch (e: any) {
                  toast.error(t("debentureDetalhe.cdiSyncError") + (e?.message ? `: ${e.message}` : ""));
                } finally {
                  setSyncingCdi(false);
                }
              }}
            >
              {syncingCdi ? t("debentureDetalhe.cdiSyncing") : t("debentureDetalhe.cdiSyncNow")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-none bg-transparent">

        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-semibold">{t("debentureDetalhe.information")}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Info label={t("debentureDetalhe.valorCota")} value={fmt(Number(deb.valor_cota))} />
            <Info label={t("debentureDetalhe.quantidadeCotas")} value={String(deb.quantidade_cotas ?? 0)} />
            <Info label={t("debentureDetalhe.rentabilidade")} value={`${Number(deb.rentabilidade_anual ?? 0).toFixed(2)}% ${deb.tipo_taxa}`} />
            <Info label={t("debentureDetalhe.vencimento")} value={fmtDate(deb.data_vencimento)} />
            <Info label={t("debentureDetalhe.disponiveis")} value={String(disponiveis.length)} />
            <Info label={t("debentureDetalhe.vendidas")} value={String(vendidas.length)} />
            <Info label={t("debentureDetalhe.totalArrecadado")} value={fmt(vendidas.length * Number(deb.valor_cota || 0))} />
            <Info label={t("debentureDetalhe.status")} value={String(deb.status)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="disponiveis" className="w-full">
        <TabsList>
          <TabsTrigger value="disponiveis">{t("debentureDetalhe.tabDisponiveis")} ({disponiveis.length})</TabsTrigger>
          <TabsTrigger value="vendidas">{t("debentureDetalhe.tabVendidas")} ({vendidas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-14 px-3 py-3 text-center font-medium">{t("debentureDetalhe.colNumero")}</th>
                    <th className="px-6 py-3 text-center font-medium">{t("debentureDetalhe.colSituacao")}</th>
                    <th className="px-6 py-3 text-center font-medium">{t("debentureDetalhe.colEmitidaEm")}</th>
                    <th className="px-6 py-3 text-center font-medium">{t("debentureDetalhe.colEmitidaPor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {disponiveisPag.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-3 py-3 text-center font-medium text-primary">{c.numero}</td>
                      <td className="px-6 py-3 text-center">
                        <Badge variant="outline" className={situacaoColor[c.situacao]}>{t("debentureDetalhe.available_one")}</Badge>
                      </td>
                      <td className="px-6 py-3 text-center text-muted-foreground">{fmtDate(c.emitida_em)}</td>
                      <td className="px-6 py-3 text-center text-muted-foreground uppercase">{emissores[c.emitida_por] || "-"}</td>
                    </tr>
                  ))}
                  {disponiveis.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-sm text-muted-foreground">{t("debentureDetalhe.noneAvailable")}</td></tr>
                  )}
                </tbody>
              </table>
              {disponiveis.length > 0 && (
                <Pager page={pageDisp} totalPages={totalPagesDisp} total={disponiveis.length} pageSize={PAGE_SIZE} onChange={setPageDisp} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendidas">
          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {(() => {
                    const SortBtn = ({ k, label, align = "center" }: { k: string; label: string; align?: "center" | "left" }) => {
                      const active = sortVendKey === k;
                      const Icon = !active ? ArrowUpDown : sortVendDir === "asc" ? ArrowUp : ArrowDown;
                      return (
                        <button
                          type="button"
                          onClick={() => toggleSortVend(k)}
                          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""} ${align === "center" ? "justify-center" : ""}`}
                        >
                          <span>{label}</span>
                          <Icon className="h-3 w-3 opacity-70" />
                        </button>
                      );
                    };
                    return (
                      <tr>
                        <th className="w-14 px-3 py-3 text-center font-medium"><SortBtn k="numero" label={t("debentureDetalhe.colNumero")} /></th>
                        <th className="px-6 py-3 text-left font-medium"><SortBtn k="cliente" label={t("debentureDetalhe.colCliente")} align="left" /></th>
                        <th className="px-6 py-3 text-left font-medium"><SortBtn k="caixa" label={t("debentureDetalhe.colCaixa")} align="left" /></th>
                        <th className="w-24 px-3 py-3 text-center font-medium"><SortBtn k="valor" label={t("debentureDetalhe.colValor")} /></th>
                        <th className="w-24 px-3 py-3 text-center font-medium"><SortBtn k="data" label={t("debentureDetalhe.colData")} /></th>
                        <th className="px-6 py-3 text-center font-medium"><SortBtn k="diasUteis" label={t("debentureDetalhe.colDiasUteis")} /></th>
                        <th className="w-28 px-3 py-3 text-center font-medium"><SortBtn k="rendDiario" label={t("debentureDetalhe.colRendDiario")} /></th>
                        <th className="w-20 px-3 py-3 text-center font-medium"><SortBtn k="percEvol" label="% Evolução" /></th>
                        <th className="w-28 px-3 py-3 text-center font-medium"><SortBtn k="rendAcum" label={t("debentureDetalhe.colRendAcumulado")} /></th>
                        <th className="w-28 px-3 py-3 text-center font-medium"><SortBtn k="rendLiq" label={t("debentureDetalhe.colRendLiquido")} /></th>
                        <th className="w-32 px-3 py-3 text-center font-medium">Ações</th>
                      </tr>
                    );
                  })()}
                </thead>
                <tbody>
                  {vendasPag.map((v: any) => {
                    const du = diasUteis(v.data_venda);
                    const rentAnual = Number(deb.rentabilidade_anual ?? 0);
                    const valorVenda = Number(v.valor || 0);
                    const opts = { ...calcOpts, dataVenda: v.data_venda };
                    const rendDiario = calcRendDiario(valorVenda, rentAnual, opts);
                    const rendAcum = calcRendimento(valorVenda, rentAnual, du, opts);
                    const rendLiq = calcLiquido(rendAcum, v.data_venda);
                    return (
                      <tr key={v.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="px-3 py-3 text-center font-medium">
                          {(v.cotas || []).length > 0 ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="inline-flex items-center justify-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium hover:bg-muted">
                                  {(v.cotas || []).length}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2 text-xs">
                                <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Cotas</div>
                                <div className="flex flex-wrap gap-1">
                                  {(v.cotas || []).map((n: string, i: number) => (
                                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono">{n}</span>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          <span className="font-medium text-foreground">{v.debenturista?.nome}</span>
                          {v.debenturista?.tipo && <span className="ml-1 text-[10px] uppercase text-muted-foreground">({v.debenturista.tipo})</span>}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{v.caixa?.nome ?? "-"}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{fmt(valorVenda)}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">
                          {fmtDate(v.data_venda)}
                        </td>
                        <td className="px-6 py-3 text-center font-medium text-foreground">{du}</td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{fmt(rendDiario)}</td>
                        <td className="px-3 py-3 text-center font-medium text-success">{valorVenda > 0 ? `${((rendAcum / valorVenda) * 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-"}</td>
                        <td className="px-3 py-3 text-center font-medium text-success">{fmt(rendAcum)}</td>
                        <td className="px-3 py-3 text-center font-medium text-success">{fmt(rendLiq)}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            {v.comprovante_path && (
                              <button
                                type="button"
                                onClick={() => abrirComprovante(v.comprovante_path)}
                                title="Ver comprovante"
                                className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => gerarCautelaPDF({
                                numero: (v.cotas && v.cotas.length > 0 ? String(v.cotas[0]) : v.id.slice(0, 8)),
                                quantidade: v.cotas?.length || v.vendaIds?.length || 1,
                                valorUnitario: Number(deb.valor_cota || 0),
                                remuneracao: `${Number(deb.rentabilidade_anual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.${deb.tipo_taxa === "CDI" ? " do CDI" : ""}`,
                                vencimento: deb.data_vencimento,
                                investidor: v.debenturista?.nome || "—",
                                dataVenda: v.data_venda,
                              })}
                              title="Gerar cautela"
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ScrollText className="h-3.5 w-3.5" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => abrirEdicaoVenda(v)}
                                  title="Alterar venda"
                                  className="p-1 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmExcluirVenda(v)}
                                  title="Excluir venda"
                                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {vendas.length === 0 && (
                    <tr><td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">{t("debentureDetalhe.noneSold")}</td></tr>
                  )}
                </tbody>
              </table>
              {vendasAgrupadas.length > 0 && (
                <Pager page={pageVend} totalPages={totalPagesVendAgr} total={vendasAgrupadas.length} pageSize={PAGE_SIZE} onChange={setPageVend} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!comprovanteUrl} onOpenChange={(o) => !o && setComprovanteUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Comprovante da venda</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 pb-4">
            {comprovanteUrl && comprovanteTipo === "pdf" && (
              <PdfViewer url={comprovanteUrl} />
            )}
            {comprovanteUrl && comprovanteTipo === "image" && (
              <img src={comprovanteUrl} alt="Comprovante" className="max-w-full max-h-full mx-auto rounded border border-border" />
            )}
            {comprovanteUrl && comprovanteTipo === "other" && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Tipo de arquivo não suportado para pré-visualização.
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6">
            {comprovanteUrl && (
              <Button asChild variant="outline">
                <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer" download>
                  Baixar
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVenda} onOpenChange={(o) => !o && setEditVenda(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar venda</DialogTitle>
          </DialogHeader>
          {editVenda && (
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>Debenturista</Label>
                <Select value={editDebenturistaId} onValueChange={setEditDebenturistaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {debenturistas.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Caixa</Label>
                <Select value={editCaixaId} onValueChange={setEditCaixaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {caixas.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Data da venda</Label>
                <Input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Comprovante de pagamento</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setEditComprovante(e.target.files?.[0] ?? null)}
                />
                {editVenda.comprovante_path && !editComprovante && (
                  <button
                    type="button"
                    onClick={() => abrirComprovante(editVenda.comprovante_path)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
                  >
                    <Paperclip className="h-3 w-3" /> Ver comprovante atual
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Enviar um novo arquivo substitui o comprovante atual de todas as cotas desta venda.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {editVenda.vendaIds.length} cota(s) serão atualizadas.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditVenda(null)}>Cancelar</Button>
            <Button onClick={salvarEdicaoVenda} disabled={savingEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmExcluirVenda} onOpenChange={(o) => !o && setConfirmExcluirVenda(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Exclusão em andamento, deseja prosseguir?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const v = confirmExcluirVenda;
                setConfirmExcluirVenda(null);
                if (v) await excluirVenda(v);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function Pager({ page, totalPages, total, pageSize, onChange }: { page: number; totalPages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const { t: tt } = useTranslation();
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
      <span>{tt("debentureDetalhe.showing")} {start}-{end} {tt("debentureDetalhe.of")} {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>{tt("common.previous")}</Button>
        <span>{tt("debentureDetalhe.page")} {page} {tt("debentureDetalhe.of")} {totalPages}</span>
        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>{tt("common.next")}</Button>
      </div>
    </div>
  );
}

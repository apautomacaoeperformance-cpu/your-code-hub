import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import jhlLogo from "@/assets/jhl-logo.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, MoreHorizontal, Pencil, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import jsPDF from "jspdf";
import { useAutoSuspenderDebentures } from "@/hooks/useAutoSuspenderDebentures";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";
import { useFeriados, diasUteis as diasUteisFn } from "@/lib/diasUteis";
import { calcRendimento, calcLiquido, type CdiMap } from "@/lib/rendimento";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

const fmtMoney = (n: number, lang: string) =>
  n.toLocaleString(localeMap[lang] ?? "pt-BR", { style: "currency", currency: "BRL" });

const statusColor: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  suspenso: "bg-warning/10 text-warning border-warning/20",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório"),
  emissao: z.string().trim().optional(),
  serie: z.string().trim().optional(),
  valor_cota: z.number().min(0),
  quantidade_cotas: z.number().int().min(0),
  tipo_taxa: z.enum(["FIXA", "CDI"]),
  rentabilidade_anual: z.number().min(0),
  tipo_retirada: z.string().optional(),
  data_inicio: z.string().optional(),
  duracao_meses: z.number().int().min(0).optional(),
  data_final_vendas: z.string().optional(),
  status: z.enum(["ativo", "suspenso", "cancelado"]),
});

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function prazoLabel(data: string, t: any) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(data + "T00:00:00");
  const diff = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return t("debentures.expired");
  if (diff === 0) return t("debentures.today");
  return `${diff} ${t("debentures.days")}`;
}

export default function Debentures() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || "pt";
  const fmt = (n: number) => fmtMoney(n, lang);
  useAutoSuspenderDebentures();
  const { data: feriados } = useFeriados();
  const diasUteis = (from: string, to: Date = new Date()) => diasUteisFn(from, to, feriados);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = {
    nome: "",
    emissao: "",
    serie: "",
    valor_cota: "",
    quantidade_cotas: "",
    tipo_taxa: "FIXA",
    rentabilidade_anual: "",
    tipo_retirada: "",
    data_inicio: today,
    duracao_meses: "",
    data_final_vendas: "",
    status: "ativo",
  };
  const [form, setForm] = useState<any>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      nome: d.nome ?? "",
      emissao: d.emissao ?? "",
      serie: d.serie ?? "",
      valor_cota: d.valor_cota?.toString() ?? "",
      quantidade_cotas: d.quantidade_cotas?.toString() ?? "",
      tipo_taxa: d.tipo_taxa ?? "FIXA",
      rentabilidade_anual: d.rentabilidade_anual?.toString() ?? "",
      tipo_retirada: d.tipo_retirada ?? "",
      data_inicio: d.data_inicio ?? today,
      duracao_meses: d.duracao_meses?.toString() ?? "",
      data_final_vendas: d.data_final_vendas ?? "",
      status: d.status ?? "ativo",
    });
    setOpen(true);
  };

  const { data: debs = [] } = useQuery({
    queryKey: ["debentures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debentures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = debs.filter((d: any) => {
    const matchQ = [d.nome, d.tipo_taxa, d.status, d.serie].some((f) => f?.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = statusFilter === "todos" || d.status === statusFilter;
    return matchQ && matchStatus;
  });

  const numericKeys = new Set(["taxa", "valor", "rentabilidade_anual", "valor_cota", "quantidade_cotas"]);
  const dateKeys = new Set(["data_vencimento", "data_inicio", "data_final_vendas", "emissao"]);
  const sortedFiltered = [...filtered].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    const rawA = a[sortConfig.key];
    const rawB = b[sortConfig.key];
    if (numericKeys.has(sortConfig.key)) {
      return ((Number(rawA) || 0) - (Number(rawB) || 0)) * dir;
    }
    if (dateKeys.has(sortConfig.key)) {
      const tA = rawA ? new Date(rawA + "T00:00:00").getTime() : 0;
      const tB = rawB ? new Date(rawB + "T00:00:00").getTime() : 0;
      return (tA - tB) * dir;
    }
    const valA = (rawA ?? "").toString().toLowerCase();
    const valB = (rawB ?? "").toString().toLowerCase();
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

  const persist = async (closeAfter: boolean) => {
    const payload: any = {
      nome: form.nome,
      emissao: form.emissao || null,
      serie: form.serie || null,
      valor_cota: Number(form.valor_cota || 0),
      quantidade_cotas: parseInt(form.quantidade_cotas || "0", 10),
      tipo_taxa: form.tipo_taxa,
      rentabilidade_anual: Number(form.rentabilidade_anual || 0),
      tipo_retirada: form.tipo_retirada || null,
      data_inicio: form.data_inicio || null,
      duracao_meses: form.duracao_meses ? parseInt(form.duracao_meses, 10) : null,
      data_final_vendas: form.data_final_vendas || null,
      status: form.status,
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      console.error("Validação debênture:", parsed.error.errors);
      return toast.error(parsed.error.errors[0].message);
    }
    payload.taxa = payload.rentabilidade_anual;
    payload.valor = payload.valor_cota * payload.quantidade_cotas;
    payload.data_vencimento =
      payload.data_inicio && payload.duracao_meses
        ? addMonths(payload.data_inicio, payload.duracao_meses)
        : payload.data_inicio || today;
    const { error } = editingId
      ? await supabase.from("debentures").update(payload).eq("id", editingId)
      : await supabase.from("debentures").insert(payload);
    if (error) {
      console.error("Erro ao salvar debênture:", error);
      return toast.error(error.message);
    }
    toast.success(editingId ? t("debentures.updated") : t("debentures.created"));
    qc.invalidateQueries({ queryKey: ["debentures"] });
    if (closeAfter) {
      setOpen(false);
      setEditingId(null);
    } else {
      setEditingId(null);
    }
    setForm(emptyForm);
  };

  const handleSave = () => persist(true);
  const handleSaveAndNew = () => persist(false);

  const handleDelete = async (id: string) => {
    if (!confirm(t("debentures.confirmDelete"))) return;
    const { error } = await supabase.from("debentures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("debentures.deleted"));
    qc.invalidateQueries({ queryKey: ["debentures"] });
  };

  const changeStatus = async (id: string, status: "ativo" | "suspenso" | "cancelado") => {
    const { error } = await supabase.from("debentures").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["debentures"] });
  };

  const [gerandoPDF, setGerandoPDF] = useState(false);
  const gerarRelatorioGeral = async () => {
    setGerandoPDF(true);
    try {
      if (debs.length === 0) {
        toast.warning(t("debentures.noneRegistered"));
        return;
      }
      const ids = debs.map((d: any) => d.id);
      // Pagina cotas em lotes para evitar o limite padrão de 1000 linhas
      const fetchAllCotas = async () => {
        const pageSize = 1000;
        let from = 0;
        const all: any[] = [];
        // loop até esgotar
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("cotas_debenture")
            .select("debenture_id, situacao")
            .in("debenture_id", ids)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const fetchAllVendas = async () => {
        const pageSize = 1000;
        let from = 0;
        const all: any[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("vendas_debenture")
            .select("debenture_id, valor, data_venda")
            .in("debenture_id", ids)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const fetchAllCdi = async () => {
        const pageSize = 1000;
        let from = 0;
        const all: any[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("cdi_diario")
            .select("data, taxa")
            .range(from, from + pageSize - 1);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }
        return all;
      };
      const [cotasAll, vendasAll, cdiAll] = await Promise.all([fetchAllCotas(), fetchAllVendas(), fetchAllCdi()]);
      const cotasRes = { data: cotasAll } as any;
      const vendasRes = { data: vendasAll } as any;
      const cdiMap: CdiMap = new Map<string, number>(
        (cdiAll || []).map((r: any) => [r.data as string, Number(r.taxa)]),
      );

      const cotasPorDeb = new Map<string, { total: number; vendidas: number }>();
      (cotasRes.data || []).forEach((c: any) => {
        const r = cotasPorDeb.get(c.debenture_id) || { total: 0, vendidas: 0 };
        r.total += 1;
        if (c.situacao && c.situacao !== "disponivel") r.vendidas += 1;
        cotasPorDeb.set(c.debenture_id, r);
      });

      const rendPorDeb = new Map<string, { valor: number; rendimento: number; rendimentoLiquido: number }>();
      (vendasRes.data || []).forEach((v: any) => {
        const deb = debs.find((d: any) => d.id === v.debenture_id);
        const rent = Number(deb?.rentabilidade_anual || 0);
        const valor = Number(v.valor || 0);
        const du = diasUteis(v.data_venda);
        const rend = calcRendimento(valor, rent, du, {
          tipoTaxa: deb?.tipo_taxa,
          cdi: cdiMap,
          dataVenda: v.data_venda,
          feriados,
        });
        const rendLiq = calcLiquido(rend, v.data_venda);
        const r = rendPorDeb.get(v.debenture_id) || { valor: 0, rendimento: 0, rendimentoLiquido: 0 };
        r.valor += valor;
        r.rendimento += rend;
        r.rendimentoLiquido += rendLiq;
        rendPorDeb.set(v.debenture_id, r);
      });

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWPdf = doc.internal.pageSize.getWidth();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWPdf, 28, "F");
      try {
        doc.addImage(jhlLogo, "PNG", pageWPdf - 14 - 28, 8, 28, 11);
      } catch (e) {
        console.warn("Falha ao inserir logo no PDF", e);
      }
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("JHL SECURITIZADORA", 14, 12);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Relatório consolidado de debêntures", 14, 19);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Debêntures · Cotas e Rendimentos", 14, 40);

      let totDisp = 0, totVend = 0, totCotas = 0, totValor = 0, totRend = 0, totRendLiq = 0;
      const body = debs.map((d: any) => {
        const c = cotasPorDeb.get(d.id) || { total: 0, vendidas: 0 };
        const r = rendPorDeb.get(d.id) || { valor: 0, rendimento: 0, rendimentoLiquido: 0 };
        const disp = c.total - c.vendidas;
        totDisp += disp; totVend += c.vendidas; totCotas += c.total;
        totValor += r.valor; totRend += r.rendimento; totRendLiq += r.rendimentoLiquido;
        return [
          d.nome,
          `${Number(d.taxa).toFixed(2)}% ${d.tipo_taxa}`,
          String(c.total),
          String(c.vendidas),
          String(disp),
          fmt(r.valor),
          fmt(r.rendimento),
          fmt(r.rendimentoLiquido),
          d.status,
        ];
      });

      autoTable(doc, {
        startY: 48,
        showFoot: "lastPage",
        head: [["Debênture", "Taxa", "Cotas", "Vendidas", "Disponíveis", "Valor Vendido", "Rend. Bruto", "Rend. Líquido", "Status"]],
        body,
        foot: [["Total", "", String(totCotas), String(totVend), String(totDisp), fmt(totValor), fmt(totRend), fmt(totRendLiq), `${debs.length} deb.`]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: "center" },
        footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center", textColor: [22, 163, 74] },
          7: { halign: "center", textColor: [22, 163, 74] },
        },
      });

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, h - 8);
        doc.text(`Página ${i} de ${pages}`, w - 14, h - 8, { align: "right" });
      }
      previewPdf(doc, `debentures_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(t("debentures.reportGenerated"));
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || t("toasts.error"));
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("debentures.title")}</h1>
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5">
            <span className="text-xs text-muted-foreground">{t("debentures.actives")}</span>
            <span className="text-base font-semibold">{debs.filter((d: any) => d.status === "ativo").length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-2" onClick={gerarRelatorioGeral} disabled={gerandoPDF}>
          <FileText className="h-4 w-4" />{gerandoPDF ? t("debentures.generating") : t("debentures.reportPdf")}
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />{t("debentures.newDebenture")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? t("debentures.editDebenture") : t("debentures.createDebenture")}</DialogTitle></DialogHeader>

            <Card className="border-border/60">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold">{t("debentures.information")}</h3>
                <div className="grid grid-cols-8 gap-3">
                  <div className="grid gap-2 col-span-6">
                    <Label className="text-center">{t("debentures.nome")}</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                  </div>
                  <div className="grid gap-2 col-span-1">
                    <Label className="text-center">{t("debentures.emissao")}</Label>
                    <Input className="text-center" value={form.emissao} onChange={(e) => setForm({ ...form, emissao: e.target.value })} />
                  </div>
                  <div className="grid gap-2 col-span-1">
                    <Label className="text-center">{t("debentures.serie")}</Label>
                    <Input className="text-center" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold">{t("debentures.pricing")}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("debentures.valorCota")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="R$"
                      value={form.valor_cota}
                      onChange={(e) => setForm({ ...form, valor_cota: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.quantidadeCotas")}</Label>
                    <Input
                      type="number"
                      value={form.quantidade_cotas}
                      onChange={(e) => setForm({ ...form, quantidade_cotas: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.tipoTaxa")}</Label>
                    <Select value={form.tipo_taxa} onValueChange={(v) => setForm({ ...form, tipo_taxa: v })}>
                      <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXA">FIXA</SelectItem>
                        <SelectItem value="CDI">CDI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.rentabilidadeAnual")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.rentabilidade_anual}
                      onChange={(e) => setForm({ ...form, rentabilidade_anual: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.tipoRetirada")}</Label>
                    <Select value={form.tipo_retirada} onValueChange={(v) => setForm({ ...form, tipo_retirada: v })}>
                      <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">{t("debentures.final")}</SelectItem>
                        <SelectItem value="mensal">{t("debentures.monthly")}</SelectItem>
                        <SelectItem value="semestral">{t("debentures.semestral")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("fields.status")}</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">{t("debentures.active")}</SelectItem>
                        <SelectItem value="suspenso">{t("debentures.suspended")}</SelectItem>
                        <SelectItem value="cancelado">{t("debentures.cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="space-y-4 p-5">
                <h3 className="text-sm font-semibold">{t("debentures.prazo")}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>{t("debentures.dataInicio")}</Label>
                    <Input
                      type="date"
                      value={form.data_inicio}
                      onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.duracaoMeses")}</Label>
                    <Input
                      type="number"
                      value={form.duracao_meses}
                      onChange={(e) => setForm({ ...form, duracao_meses: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("debentures.dataFinalVendas")}</Label>
                    <Input
                      type="date"
                      value={form.data_final_vendas}
                      onChange={(e) => setForm({ ...form, data_final_vendas: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={handleSave}>{editingId ? t("common.save") : t("common.create")}</Button>
              <Button variant="outline" onClick={handleSaveAndNew}>{t("debentures.saveAndNew")}</Button>
              <Button variant="ghost" onClick={() => { setForm(emptyForm); setOpen(false); }}>{t("common.cancel")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("debentures.filterStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("debentures.allStatuses")}</SelectItem>
                <SelectItem value="ativo">{t("debentures.active")}</SelectItem>
                <SelectItem value="suspenso">{t("debentures.suspended")}</SelectItem>
                <SelectItem value="cancelado">{t("debentures.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("debentures.search")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-14.5rem)] overflow-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-muted [&_th]:border-y [&_th]:border-border">
                <tr>
                  <th
                    className="px-4 py-1.5 text-left font-medium w-[28%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("nome")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colNome")} <SortIcon k="nome" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[10%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("taxa")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colTaxa")} <SortIcon k="taxa" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[6%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("serie")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colSerie")} <SortIcon k="serie" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[12%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("valor")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colValor")} <SortIcon k="valor" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[11%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("data_vencimento")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colVencimento")} <SortIcon k="data_vencimento" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[11%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("data_vencimento")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colPrazo")} <SortIcon k="data_vencimento" />
                    </span>
                  </th>
                  <th
                    className="px-2 py-1.5 text-left font-medium w-[9%] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("status")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {t("debentures.colStatus")} <SortIcon k="status" />
                    </span>
                  </th>
                  <th className="px-2 py-1.5 w-[6%]"></th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map((d: any) => (
                  <tr key={d.id} className="border-b border-border/60 transition-smooth hover:bg-muted/30">
                    <td className="px-4 py-1 font-medium text-foreground truncate" title={d.nome}>
                      <Link to={`/operacoes/debentures/${d.id}`} className="text-primary hover:underline">{d.nome}</Link>
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {Number(d.taxa).toFixed(2)}% {d.tipo_taxa}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground text-center">{d.serie || "—"}</td>
                    <td className="px-2 py-1 text-muted-foreground">{fmt(Number(d.valor))}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {new Date(d.data_vencimento + "T00:00:00").toLocaleDateString(localeMap[lang] ?? "pt-BR")}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{prazoLabel(d.data_vencimento, t)}</td>
                    <td className="px-2 py-1">
                      <Select value={d.status} onValueChange={(v: any) => changeStatus(d.id, v)}>
                        <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent p-0 hover:bg-transparent focus:ring-0 [&>svg]:hidden">
                          <Badge variant="outline" className={d.status === "ativo" && d.tipo_taxa === "CDI" ? "bg-blue-100 text-blue-700 border-blue-200" : statusColor[d.status]}>
                            {d.status === "ativo" ? t("debentures.active") : d.status === "suspenso" ? t("debentures.suspended") : t("debentures.cancelled")}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">{t("debentures.active")}</SelectItem>
                          <SelectItem value="suspenso">{t("debentures.suspended")}</SelectItem>
                          <SelectItem value="cancelado">{t("debentures.cancelled")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => openEdit(d)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("common.edit")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {sortedFiltered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                      {t("debentures.none")}
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

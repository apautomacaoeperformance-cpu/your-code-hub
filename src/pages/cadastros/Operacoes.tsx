import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, FileDown, MoreHorizontal, CheckCircle2, AlertTriangle, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { exportOperacoesPDF } from "@/lib/pdf";
import { useAutoInadimplencia } from "@/hooks/useAutoInadimplencia";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

const statusColor: Record<string, string> = {
  ativa: "bg-success/10 text-success border-success/20",
  liquidada: "bg-muted text-muted-foreground border-border",
  inadimplente: "bg-destructive/10 text-destructive border-destructive/20",
  rascunho: "bg-warning/10 text-warning border-warning/20",
  cancelada: "bg-muted text-muted-foreground border-border",
};

const schema = z.object({
  numero: z.string().trim().regex(/^CCB-\d{4}-\d{5}$/, "Número inválido"),
  cedente_id: z.string().uuid(),
  sacado_id: z.string().uuid(),
  valor_principal: z.number().positive(),
  taxa_mensal: z.number().min(0).max(100),
  prazo_dias: z.number().int().positive(),
  data_emissao: z.string(),
  data_vencimento: z.string(),
  status: z.enum(["rascunho", "ativa", "liquidada", "inadimplente", "cancelada"]),
});

export default function Operacoes() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) => n.toLocaleString(locale, { style: "currency", currency: "BRL" });
  const statusLabel: Record<string, string> = {
    ativa: t("operacoes.stActive"),
    liquidada: t("operacoes.stSettled"),
    inadimplente: t("operacoes.stOverdue"),
    rascunho: t("operacoes.stDraft"),
    cancelada: t("operacoes.stCanceled"),
  };

  const qc = useQueryClient();
  useAutoInadimplencia();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<any>({
    numero: "",
    cedente_id: "",
    sacado_id: "",
    valor_principal: "",
    taxa_mensal: "2.5",
    prazo_dias: "30",
    data_emissao: today,
    data_vencimento: today,
    status: "ativa",
  });

  const { data: ops = [] } = useQuery({
    queryKey: ["operacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacoes")
        .select("*, cedentes(razao_social), sacados(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cedentes = [] } = useQuery({
    queryKey: ["cedentes-list"],
    queryFn: async () => (await supabase.from("cedentes").select("id, razao_social").order("razao_social")).data ?? [],
  });

  const { data: sacados = [] } = useQuery({
    queryKey: ["sacados-list"],
    queryFn: async () => (await supabase.from("sacados").select("id, nome").order("nome")).data ?? [],
  });

  const generateNextNumero = async () => {
    const year = new Date().getFullYear();
    const prefix = `CCB-${year}-`;
    const { data } = await supabase
      .from("operacoes")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    let next = 1;
    if (data && data[0]?.numero) {
      const seq = parseInt(data[0].numero.slice(prefix.length), 10);
      if (!isNaN(seq)) next = seq + 1;
    }
    return `${prefix}${String(next).padStart(5, "0")}`;
  };

  useEffect(() => {
    if (open) {
      generateNextNumero().then((numero) => setForm((f: any) => ({ ...f, numero })));
    }
  }, [open]);

  const filtered = ops.filter((o: any) => {
    const matchTxt = [o.numero, o.cedentes?.razao_social, o.sacados?.nome].some((f) =>
      f?.toLowerCase().includes(q.toLowerCase())
    );
    if (!matchTxt) return false;
    if (inicio && o.data_emissao < inicio) return false;
    if (fim && o.data_emissao > fim) return false;
    if (statusFilter !== "todos" && o.status !== statusFilter) return false;
    return true;
  });

  const handleSave = async () => {
    const payload = {
      ...form,
      valor_principal: Number(form.valor_principal),
      taxa_mensal: Number(form.taxa_mensal),
      prazo_dias: Number(form.prazo_dias),
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const { error } = await supabase.from("operacoes").insert(parsed.data as any);
    if (error) return toast.error(error.message);
    toast.success(t("operacoes.saved"));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["operacoes"] });
    qc.invalidateQueries({ queryKey: ["ops-dash"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("operacoes.confirmDelete"))) return;
    const { error } = await supabase.from("operacoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("operacoes.deleted"));
    qc.invalidateQueries({ queryKey: ["operacoes"] });
  };

  const changeStatus = async (
    op: any,
    newStatus: "ativa" | "liquidada" | "inadimplente" | "cancelada",
  ) => {
    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "liquidada") {
      update.data_liquidacao = new Date().toISOString().slice(0, 10);
    } else {
      update.data_liquidacao = null;
    }
    const { data, error } = await supabase
      .from("operacoes")
      .update(update)
      .eq("id", op.id)
      .select("id,status,data_liquidacao,updated_at")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return toast.error(t("operacoes.noPermission"));
    qc.setQueryData(["operacoes"], (current: Array<{ id: string; [key: string]: unknown }> | undefined) =>
      current?.map((item) => (item.id === op.id ? { ...item, ...data } : item)) ?? current,
    );
    toast.success(
      newStatus === "liquidada" ? t("operacoes.settled")
      : newStatus === "inadimplente" ? t("operacoes.markedOverdue")
      : newStatus === "ativa" ? t("operacoes.reactivated")
      : t("operacoes.canceled"),
    );
    qc.invalidateQueries({ queryKey: ["operacoes"] });
    qc.invalidateQueries({ queryKey: ["ops-dash"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("operacoes.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("operacoes.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportOperacoesPDF(filtered as any, { inicio, fim, status: statusFilter })}
          >
            <FileDown className="h-4 w-4" />{t("operacoes.exportPdf")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{t("operacoes.newOp")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("operacoes.newOpDialog")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{t("operacoes.number")}</Label><Input value={form.numero} readOnly disabled placeholder="CCB-2026-00001" /></div>
                <div className="grid gap-2">
                  <Label>{t("operacoes.status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">{t("operacoes.stDraft")}</SelectItem>
                      <SelectItem value="ativa">{t("operacoes.stActive")}</SelectItem>
                      <SelectItem value="liquidada">{t("operacoes.stSettled")}</SelectItem>
                      <SelectItem value="inadimplente">{t("operacoes.stOverdue")}</SelectItem>
                      <SelectItem value="cancelada">{t("operacoes.stCanceled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{t("operacoes.cedente")} *</Label>
                  <Select value={form.cedente_id} onValueChange={(v) => setForm({ ...form, cedente_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("operacoes.select")} /></SelectTrigger>
                    <SelectContent>
                      {cedentes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("operacoes.sacado")} *</Label>
                  <Select value={form.sacado_id} onValueChange={(v) => setForm({ ...form, sacado_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("operacoes.select")} /></SelectTrigger>
                    <SelectContent>
                      {sacados.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2"><Label>{t("operacoes.value")} *</Label><Input type="number" step="0.01" value={form.valor_principal} onChange={(e) => setForm({ ...form, valor_principal: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("operacoes.monthlyRate")}</Label><Input type="number" step="0.01" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("operacoes.termDays")}</Label><Input type="number" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{t("operacoes.issuance")}</Label><Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("operacoes.maturity")}</Label><Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("operacoes.cancel")}</Button>
              <Button onClick={handleSave}>{t("operacoes.register")}</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Label className="text-xs text-muted-foreground">{t("operacoes.search")}</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("operacoes.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("operacoes.startIssuance")}</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("operacoes.endIssuance")}</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("operacoes.filterStatus")}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("operacoes.allStatuses")}</SelectItem>
                <SelectItem value="rascunho">{t("operacoes.stDraft")}</SelectItem>
                <SelectItem value="ativa">{t("operacoes.stActive")}</SelectItem>
                <SelectItem value="liquidada">{t("operacoes.stSettled")}</SelectItem>
                <SelectItem value="inadimplente">{t("operacoes.stOverdue")}</SelectItem>
                <SelectItem value="cancelada">{t("operacoes.stCanceled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">{t("operacoes.colNumber")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("operacoes.colCedente")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("operacoes.colSacado")}</th>
                  <th className="px-6 py-3 text-right font-medium">{t("operacoes.colValue")}</th>
                  <th className="px-6 py-3 text-right font-medium">{t("operacoes.colRate")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("operacoes.colMaturity")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("operacoes.colStatus")}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/60 transition-smooth hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground">{o.numero}</td>
                    <td className="px-6 py-3 text-muted-foreground">{o.cedentes?.razao_social}</td>
                    <td className="px-6 py-3 text-muted-foreground">{o.sacados?.nome}</td>
                    <td className="px-6 py-3 text-right font-medium">{fmt(Number(o.valor_principal))}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">{Number(o.taxa_mensal).toFixed(2)}%</td>
                    <td className="px-6 py-3 text-muted-foreground">{new Date(o.data_vencimento).toLocaleDateString(locale)}</td>
                    <td className="px-6 py-3"><Badge variant="outline" className={statusColor[o.status]}>{statusLabel[o.status] ?? o.status}</Badge></td>
                    <td className="px-6 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-popover">
                          <DropdownMenuLabel>{t("operacoes.changeStatus")}</DropdownMenuLabel>
                          {o.status !== "liquidada" && (
                            <DropdownMenuItem onClick={() => changeStatus(o, "liquidada")}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                              {t("operacoes.settle")}
                            </DropdownMenuItem>
                          )}
                          {o.status !== "inadimplente" && (
                            <DropdownMenuItem onClick={() => changeStatus(o, "inadimplente")}>
                              <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                              {t("operacoes.markOverdue")}
                            </DropdownMenuItem>
                          )}
                          {o.status !== "ativa" && (
                            <DropdownMenuItem onClick={() => changeStatus(o, "ativa")}>
                              <RotateCcw className="mr-2 h-4 w-4 text-primary" />
                              {t("operacoes.reactivate")}
                            </DropdownMenuItem>
                          )}
                          {o.status !== "cancelada" && (
                            <DropdownMenuItem onClick={() => changeStatus(o, "cancelada")}>
                              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                              {t("operacoes.cancelOp")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(o.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("operacoes.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">{t("operacoes.none")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

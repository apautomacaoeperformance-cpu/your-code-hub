import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function Caixas() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) => Number(n || 0).toLocaleString(locale, { style: "currency", currency: "BRL" });

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const empty = { nome: "", saldo: "", banco: "", agencia: "", conta: "", chave_pix: "" };
  const [form, setForm] = useState<any>(empty);

  const { data: caixas = [] } = useQuery({
    queryKey: ["caixas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("caixas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      caixas.filter((c: any) =>
        [c.nome, c.banco, c.agencia, c.conta].some((f) => (f ?? "").toLowerCase().includes(q.toLowerCase())),
      ),
    [caixas, q],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome ?? "",
      saldo: c.saldo?.toString() ?? "",
      banco: c.banco ?? "",
      agencia: c.agencia ?? "",
      conta: c.conta ?? "",
      chave_pix: c.chave_pix ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast.error(t("caixas.nameRequired"));
    const payload = {
      nome: form.nome.trim(),
      saldo: Number(form.saldo || 0),
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      chave_pix: form.chave_pix.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("caixas").update(payload).eq("id", editingId)
      : await supabase.from("caixas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? t("caixas.saved") : t("caixas.created"));
    setOpen(false);
    setEditingId(null);
    setForm(empty);
    qc.invalidateQueries({ queryKey: ["caixas"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("caixas.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />{t("caixas.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingId ? t("caixas.editDialog") : t("caixas.newDialog")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2 col-span-2">
                <Label>{t("caixas.name")}</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("caixas.initialBalance")}</Label>
                <Input type="number" step="0.01" value={form.saldo} onChange={(e) => setForm({ ...form, saldo: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("caixas.bank")}</Label>
                <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("caixas.agency")}</Label>
                <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("caixas.account")}</Label>
                <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
              </div>
              <div className="grid gap-2 col-span-2">
                <Label>{t("caixas.pixKey")}</Label>
                <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("caixas.cancel")}</Button>
              <Button onClick={handleSave}>{editingId ? t("caixas.save") : t("caixas.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex justify-end p-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("caixas.search")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="border-y border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-2 text-left font-medium">{t("caixas.colName")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("caixas.colBalance")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("caixas.colBank")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("caixas.colAgency")}</th>
                <th className="px-6 py-2 text-left font-medium">{t("caixas.colAccount")}</th>
                <th className="px-6 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-6 py-2 font-medium text-foreground">{c.nome}</td>
                  <td className="px-6 py-2 text-muted-foreground">{fmt(Number(c.saldo))}</td>
                  <td className="px-6 py-2 text-muted-foreground">{c.banco || "NA"}</td>
                  <td className="px-6 py-2 text-muted-foreground">{c.agencia || "NA"}</td>
                  <td className="px-6 py-2 text-muted-foreground">{c.conta || "NA"}</td>
                  <td className="px-6 py-2 text-right">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3" />{t("caixas.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">{t("caixas.none")}</td></tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            {t("caixas.showing", { n: filtered.length, total: caixas.length })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

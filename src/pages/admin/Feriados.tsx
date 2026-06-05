import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";

type Feriado = { data: string; descricao: string; tipo: string };

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function Feriados() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Feriado | null>(null);
  const [form, setForm] = useState<Feriado>({ data: "", descricao: "", tipo: "nacional" });
  const [importYear, setImportYear] = useState<string>(String(new Date().getFullYear()));
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: feriados = [], isLoading } = useQuery({
    queryKey: ["feriados-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feriados")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Feriado[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: Feriado) => {
      const { error } = await supabase.from("feriados").upsert({
        data: f.data,
        descricao: f.descricao.trim(),
        tipo: f.tipo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("feriados.saved"));
      qc.invalidateQueries({ queryKey: ["feriados-admin"] });
      qc.invalidateQueries({ queryKey: ["feriados"] });
      setOpen(false);
      setEditing(null);
      setForm({ data: "", descricao: "", tipo: "nacional" });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const remove = useMutation({
    mutationFn: async (data: string) => {
      const { error } = await supabase.from("feriados").delete().eq("data", data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("feriados.deleted"));
      qc.invalidateQueries({ queryKey: ["feriados-admin"] });
      qc.invalidateQueries({ queryKey: ["feriados"] });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const importNacionais = useMutation({
    mutationFn: async (ano: number) => {
      const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      if (!resp.ok) throw new Error(`BrasilAPI ${resp.status}`);
      const rows: { date: string; name: string; type: string }[] = await resp.json();
      if (!rows.length) return { inserted: 0, total: 0 };
      const records = rows.map((r) => ({
        data: r.date,
        descricao: r.name,
        tipo: "nacional",
      }));
      const { error, count } = await supabase
        .from("feriados")
        .upsert(records, { onConflict: "data", count: "exact" });
      if (error) throw error;
      return { inserted: count ?? records.length, total: rows.length };
    },
    onSuccess: ({ inserted, total }) => {
      toast.success(t("feriados.importSuccess", { inserted, total }));
      qc.invalidateQueries({ queryKey: ["feriados-admin"] });
      qc.invalidateQueries({ queryKey: ["feriados"] });
    },
    onError: (e: any) => toast.error(`${t("feriados.importError")}: ${e.message ?? e}`),
  });

  const handleImport = () => {
    const y = parseInt(importYear, 10);
    if (!y || y < 1900 || y > 2100) {
      toast.error(t("feriados.invalidYear"));
      return;
    }
    importNacionais.mutate(y);
  };

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(localeMap[i18n.language] ?? "pt-BR");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data || !form.descricao.trim()) {
      toast.error(t("feriados.required"));
      return;
    }
    upsert.mutate(form);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ data: "", descricao: "", tipo: "nacional" });
    setOpen(true);
  };

  const openEdit = (f: Feriado) => {
    setEditing(f);
    setForm(f);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            {t("feriados.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("feriados.subtitle")}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label className="text-xs">{t("feriados.year")}</Label>
            <Input
              type="number"
              min={1900}
              max={2100}
              value={importYear}
              onChange={(e) => setImportYear(e.target.value)}
              className="w-20 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={importNacionais.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {importNacionais.isPending ? t("feriados.importing") : t("feriados.importNational")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                {t("feriados.new")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editing ? t("feriados.edit") : t("feriados.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div>
                  <Label>{t("feriados.date")}</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    disabled={!!editing}
                    required
                  />
                </div>
                <div>
                  <Label>{t("feriados.description")}</Label>
                  <Input
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <Label>{t("feriados.type")}</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nacional">{t("feriados.tipoNacional")}</SelectItem>
                      <SelectItem value="estadual">{t("feriados.tipoEstadual")}</SelectItem>
                      <SelectItem value="municipal">{t("feriados.tipoMunicipal")}</SelectItem>
                      <SelectItem value="bancario">{t("feriados.tipoBancario")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">{t("feriados.date")}</th>
                <th className="px-4 py-3 font-medium">{t("feriados.description")}</th>
                <th className="px-4 py-3 font-medium">{t("feriados.type")}</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              ) : feriados.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t("feriados.empty")}</td></tr>
              ) : (
                feriados.map((f) => (
                  <tr key={f.data} className="border-b last:border-0">
                    <td className="px-4 py-1.5">{fmtDate(f.data)}</td>
                    <td className="px-4 py-1.5">{f.descricao}</td>
                    <td className="px-4 py-1.5 capitalize">{t(`feriados.tipo${f.tipo.charAt(0).toUpperCase() + f.tipo.slice(1)}`)}</td>
                    <td className="px-4 py-1.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(f.data)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feriados.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? fmtDate(deleteTarget) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

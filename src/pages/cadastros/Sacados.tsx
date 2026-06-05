import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { maskDocumento, maskPhone } from "@/lib/simulador/formatters";


const statusColor: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  suspenso: "bg-warning/10 text-warning border-warning/20",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20",
};

const schema = z.object({
  tipo: z.enum(["PF", "PJ"]),
  nome: z.string().trim().min(2).max(200),
  documento: z.string().trim().min(11).max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
});

export default function Sacados() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ tipo: "PJ", nome: "", documento: "", email: "", telefone: "", cidade: "", estado: "" });

  const { data = [] } = useQuery({
    queryKey: ["sacados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sacados").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const filtered = data.filter((s: any) =>
    [s.nome, s.documento].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const { error } = await supabase.from("sacados").insert(parsed.data as any);
    if (error) return toast.error(error.message);
    toast.success(t("sacados.saved"));
    setOpen(false);
    setForm({ tipo: "PJ", nome: "", documento: "", email: "", telefone: "", cidade: "", estado: "" });
    qc.invalidateQueries({ queryKey: ["sacados"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("sacados.confirmDelete"))) return;
    const { error } = await supabase.from("sacados").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("sacados.deleted"));
    qc.invalidateQueries({ queryKey: ["sacados"] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("sacados").update({ status, ativo: status === "ativo" } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("sacados.statusUpdated"));
    qc.invalidateQueries({ queryKey: ["sacados"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("sacados.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{t("sacados.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("sacados.newDialog")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="grid gap-2">
                  <Label>{t("sacados.type")}</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PJ">PJ</SelectItem>
                      <SelectItem value="PF">PF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>{form.tipo === "PJ" ? t("sacados.cnpj") : t("sacados.cpf")} *</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: maskDocumento(e.target.value) })} placeholder={form.tipo === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} /></div>
              </div>
              <div className="grid gap-2"><Label>{form.tipo === "PJ" ? t("sacados.razao") : t("sacados.fullName")} *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{t("sacados.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("sacados.phone")}</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="grid gap-2"><Label>{t("sacados.city")}</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("sacados.uf")}</Label><Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("sacados.cancel")}</Button>
              <Button onClick={handleSave}>{t("sacados.register")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("sacados.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colName")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colType")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colDoc")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colEmail")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colPhone")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colCity")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("sacados.colStatus")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/60 transition-smooth hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-secondary p-1.5"><Users className="h-3.5 w-3.5 text-primary" /></div>
                        {s.nome}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{s.tipo}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.documento}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.telefone || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{[s.cidade, s.estado].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-2">
                      <Select value={s.status ?? "ativo"} onValueChange={(v) => handleStatusChange(s.id, v)}>
                        <SelectTrigger className={`h-8 w-32 border ${statusColor[s.status ?? "ativo"]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">{t("sacados.stActive")}</SelectItem>
                          <SelectItem value="suspenso">{t("sacados.stSuspended")}</SelectItem>
                          <SelectItem value="cancelado">{t("sacados.stCanceled")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">{t("sacados.none")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

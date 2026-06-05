import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2, Trash2, FileSignature } from "lucide-react";
import { gerarTermoCedentePDF } from "@/lib/termoInvestimento";
import { maskCNPJ, maskPhone } from "@/lib/simulador/formatters";


const statusColor: Record<string, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  suspenso: "bg-warning/10 text-warning border-warning/20",
  cancelado: "bg-destructive/10 text-destructive border-destructive/20",
};
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  razao_social: z.string().trim().min(2).max(200),
  nome_fantasia: z.string().trim().max(200).optional(),
  cnpj: z.string().trim().min(14).max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional(),
  cidade: z.string().trim().max(100).optional(),
  estado: z.string().trim().max(2).optional(),
});

export default function Cedentes() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "", cidade: "", estado: "" });

  const { data = [] } = useQuery({
    queryKey: ["cedentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cedentes").select("*").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const filtered = data.filter((c: any) =>
    [c.razao_social, c.nome_fantasia, c.cnpj].some((f) => f?.toLowerCase().includes(q.toLowerCase()))
  );

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    const { error } = await supabase.from("cedentes").insert(parsed.data as any);
    if (error) return toast.error(error.message);
    toast.success(t("cedentes.saved"));
    setOpen(false);
    setForm({ razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "", cidade: "", estado: "" });
    qc.invalidateQueries({ queryKey: ["cedentes"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("cedentes.confirmDelete"))) return;
    const { error } = await supabase.from("cedentes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("cedentes.deleted"));
    qc.invalidateQueries({ queryKey: ["cedentes"] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("cedentes").update({ status, ativo: status === "ativo" } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("cedentes.statusUpdated"));
    qc.invalidateQueries({ queryKey: ["cedentes"] });
  };

  const gerarTermo = async (id: string) => {
    const c = data.find((x: any) => x.id === id);
    if (!c) return;
    
    try {
      await gerarTermoCedentePDF({
        id: c.id,
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia,
        cnpj: c.cnpj,
        email: c.email,
        telefone: c.telefone,
        endereco: c.endereco,
        cidade: c.cidade,
        estado: c.estado,
      });
    } catch (error: any) {
      toast.error("Erro ao gerar PDF: " + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("cedentes.title")}</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{t("cedentes.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("cedentes.newDialog")}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>{t("cedentes.razao")} *</Label><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{t("cedentes.fantasia")}</Label><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("cedentes.cnpj")} *</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>{t("cedentes.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("cedentes.phone")}</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" /></div>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="grid gap-2"><Label>{t("cedentes.city")}</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
                <div className="grid gap-2"><Label>{t("cedentes.uf")}</Label><Input maxLength={2} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cedentes.cancel")}</Button>
              <Button onClick={handleSave}>{t("cedentes.register")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("cedentes.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colRazao")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colFantasia")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colCnpj")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colEmail")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colCity")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("cedentes.colStatus")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/60 transition-smooth hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-secondary p-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /></div>
                        {c.razao_social}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.nome_fantasia || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.cnpj}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-2">
                      <Select value={c.status ?? "ativo"} onValueChange={(v) => handleStatusChange(c.id, v)}>
                        <SelectTrigger className={`h-7 w-28 border ${statusColor[c.status ?? "ativo"]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">{t("cedentes.stActive")}</SelectItem>
                          <SelectItem value="suspenso">{t("cedentes.stSuspended")}</SelectItem>
                          <SelectItem value="cancelado">{t("cedentes.stCanceled")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => gerarTermo(c.id)} title="Termo">
                        <FileSignature className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">{t("cedentes.none")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

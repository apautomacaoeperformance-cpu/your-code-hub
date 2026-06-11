import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, UserPlus, Trash2, Pencil, KeyRound } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "gestor" | "operador" | "investidor";

export default function Usuarios() {
  const { t } = useTranslation();
  const { roles, user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [pwdUser, setPwdUser] = useState<{ id: string; email: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdForceChange, setPwdForceChange] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "operador" as AppRole, must_change_password: true });

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, created_at, ativo").order("created_at", { ascending: false });
      const { data: rolesRows } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (rolesRows ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  if (authLoading) return null;
  if (!roles.includes("admin")) return <Navigate to="/" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error(t("usuarios.passwordMin"));
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: form });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? t("usuarios.createError"));
    }
    toast.success(t("usuarios.createSuccess"));
    setForm({ full_name: "", email: "", password: "", role: "operador", must_change_password: true });
    qc.invalidateQueries({ queryKey: ["usuarios-list"] });
  };

  const handleChangeRole = async (userId: string, newRole: AppRole) => {
    if (userId === user?.id) return toast.error(t("usuarios.cannotEditSelf"));
    setUpdatingId(userId);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      setUpdatingId(null);
      return toast.error(delErr.message);
    }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    setUpdatingId(null);
    if (insErr) return toast.error(insErr.message);
    toast.success(t("usuarios.roleUpdated"));
    qc.invalidateQueries({ queryKey: ["usuarios-list"] });
  };

  const handleToggleAtivo = async (userId: string, novo: boolean) => {
    if (userId === user?.id) return toast.error("Não é possível alterar o próprio status");
    setUpdatingId(userId);
    const { error } = await supabase.from("profiles").update({ ativo: novo }).eq("id", userId);
    setUpdatingId(null);
    if (error) return toast.error(error.message);
    toast.success(novo ? "Usuário ativado" : "Usuário desativado");
    qc.invalidateQueries({ queryKey: ["usuarios-list"] });
  };

  const handleDelete = async (userId: string) => {
    if (userId === user?.id) return toast.error("Não é possível excluir o próprio usuário");
    setDeletingId(userId);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
    setDeletingId(null);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao excluir");
    }
    toast.success("Usuário excluído");
    qc.invalidateQueries({ queryKey: ["usuarios-list"] });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { user_id: editing.id, full_name: editing.full_name, email: editing.email },
    });
    setEditSaving(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao atualizar");
    }
    toast.success("Usuário atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["usuarios-list"] });
  };

  const handleResetPassword = async () => {
    if (!pwdUser) return;
    if (newPwd.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    setPwdSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { user_id: pwdUser.id, password: newPwd, must_change_password: pwdForceChange },
    });
    setPwdSaving(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao redefinir senha");
    }
    toast.success("Senha redefinida");
    setPwdUser(null);
    setNewPwd("");
    setPwdForceChange(true);
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("usuarios.title")}</h1>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm"><UserPlus className="h-4 w-4" /> {t("usuarios.newUser")}</CardTitle>
          <CardDescription className="text-xs">{t("usuarios.newUserDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleCreate} className="grid gap-x-3 gap-y-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs">{t("usuarios.fullName")}</Label>
              <Input id="nome" className="h-8 text-xs" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">{t("usuarios.email")}</Label>
              <Input id="email" type="email" className="h-8 text-xs" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="senha" className="text-xs">{t("usuarios.password")}</Label>
              <Input id="senha" type="password" className="h-8 text-xs" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role" className="text-xs">{t("usuarios.role")}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                <SelectTrigger id="role" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("usuarios.roleAdmin")}</SelectItem>
                  <SelectItem value="gestor">{t("usuarios.roleManager")}</SelectItem>
                  <SelectItem value="operador">{t("usuarios.roleOperator")}</SelectItem>
                  <SelectItem value="investidor">{t("usuarios.roleInvestor")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="sm" className="text-xs" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}{t("usuarios.create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t("usuarios.registered")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9 w-[35%] text-xs">{t("usuarios.colName")}</TableHead>
                  <TableHead className="h-9 text-xs">{t("usuarios.colEmail")}</TableHead>
                  <TableHead className="h-9 text-xs">{t("usuarios.colRole")}</TableHead>
                  <TableHead className="h-9 w-[200px] text-xs">{t("usuarios.colChange")}</TableHead>
                  <TableHead className="h-9 w-[50px] text-xs text-center">Status</TableHead>
                  <TableHead className="h-9 w-[96px] px-0 text-center text-[10px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios?.map((u) => {
                  const currentRole = u.roles[0] ?? "operador";
                  const isSelf = u.id === user?.id;
                  const ativo = (u as any).ativo ?? true;
                  return (
                    <TableRow key={u.id} className={!ativo ? "opacity-60" : ""}>
                      <TableCell className="py-2 text-xs">{u.full_name || "—"}</TableCell>
                      <TableCell className="py-2 text-xs">{u.email}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                            u.roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={currentRole}
                            disabled={isSelf || updatingId === u.id}
                            onValueChange={(v) => handleChangeRole(u.id, v as AppRole)}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t("usuarios.roleAdmin")}</SelectItem>
                              <SelectItem value="gestor">{t("usuarios.roleManager")}</SelectItem>
                              <SelectItem value="operador">{t("usuarios.roleOperator")}</SelectItem>
                              <SelectItem value="investidor">{t("usuarios.roleInvestor")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingId === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        </div>
                        {isSelf && <p className="mt-1 text-[10px] text-muted-foreground">{t("usuarios.cannotSelf")}</p>}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={ativo}
                            disabled={isSelf || updatingId === u.id}
                            onCheckedChange={(v) => handleToggleAtivo(u.id, v)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-0 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="!h-5 !w-5 min-w-[20px] !p-0"
                            title="Editar"
                            onClick={() => setEditing({ id: u.id, full_name: u.full_name ?? "", email: u.email ?? "" })}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="!h-5 !w-5 min-w-[20px] !p-0"
                            title="Redefinir senha"
                            onClick={() => { setPwdUser({ id: u.id, email: u.email ?? "" }); setNewPwd(""); }}
                          >
                            <KeyRound className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="!h-5 !w-5 min-w-[20px] !p-0 text-destructive hover:text-destructive"
                                disabled={isSelf || deletingId === u.id}
                                title="Excluir"
                              >
                                {deletingId === u.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação é permanente. O usuário <strong>{u.full_name || u.email}</strong> e todos os seus acessos serão removidos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(u.id)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize nome e email do usuário.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo</Label>
                <Input
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editSaving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdUser} onOpenChange={(o) => { if (!o) { setPwdUser(null); setNewPwd(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{pwdUser?.email}</strong>. Mínimo de 8 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Nova senha</Label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwdUser(null); setNewPwd(""); }} disabled={pwdSaving}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={pwdSaving}>
              {pwdSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

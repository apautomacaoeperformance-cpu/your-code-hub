import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function TrocarSenha() {
  const navigate = useNavigate();
  const { user, loading, mustChangePassword, refreshProfile, signOut } = useAuth();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
    if (!loading && user && !mustChangePassword) navigate("/", { replace: true });
  }, [loading, user, mustChangePassword, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (pwd !== confirm) return toast.error("As senhas não conferem");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user!.id);
    setSaving(false);
    if (profErr) return toast.error(profErr.message);
    toast.success("Senha alterada com sucesso");
    await refreshProfile();
    navigate("/", { replace: true });
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-sm border-border/60 shadow-elegant">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Trocar senha</CardTitle>
          <CardDescription>
            Por segurança, defina uma nova senha para continuar acessando o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pwd">Nova senha</Label>
              <Input
                id="new-pwd"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
              <Input
                id="confirm-pwd"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar nova senha
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate("/auth", { replace: true });
              }}
              disabled={saving}
            >
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

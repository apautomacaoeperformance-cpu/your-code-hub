import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Backup() {
  const [loading, setLoading] = useState(false);

  async function gerarBackup() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/backup-database`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: ANON_KEY,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { msg = JSON.parse(text).error ?? text; } catch { /* ignore */ }
        throw new Error(msg || `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Backup gerado com sucesso!");
    } catch (e) {
      toast.error(`Falha ao gerar backup: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Backup do Banco de Dados</h1>
        <p className="text-muted-foreground">
          Gere um arquivo ZIP contendo um CSV de cada tabela do banco.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Exportar todas as tabelas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O backup inclui um arquivo <code>.csv</code> por tabela do schema
            <code> public</code>, além de um <code>manifest.json</code> com a
            contagem de linhas exportadas. Apenas administradores podem executar
            esta operação.
          </p>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              Para bases muito grandes, a geração pode levar alguns minutos.
              Mantenha a aba aberta durante o processo.
            </div>
          </div>

          <Button size="lg" onClick={gerarBackup} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando backup...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Baixar backup (.zip)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

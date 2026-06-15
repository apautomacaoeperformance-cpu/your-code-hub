import { useState } from "react";
import JSZip from "jszip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "object") {
    try { str = JSON.stringify(value); } catch { str = String(value); }
  } else {
    str = String(value);
  }
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

const PUBLIC_TABLES = [
  "access_logs",
  "app_parameters",
  "caixas",
  "cdi_auditoria",
  "cdi_diario",
  "cedentes",
  "cotas_debenture",
  "debentures",
  "debenturistas",
  "feriados",
  "informes_rendimento",
  "integrations_log",
  "operacoes",
  "profiles",
  "rendimentos_debenture",
  "retiradas_debenture",
  "sacados",
  "user_roles",
  "vendas_debenture",
].sort();

async function listPublicTables(): Promise<string[]> {
  return PUBLIC_TABLES;
}

export default function Backup() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  async function gerarBackup() {
    setLoading(true);
    setProgress("Listando tabelas...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const tables = await listPublicTables();
      if (tables.length === 0) throw new Error("Nenhuma tabela encontrada.");

      const zip = new JSZip();
      const manifest: { table: string; rows: number; error?: string }[] = [];

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress(`Exportando ${i + 1}/${tables.length}: ${table}`);
        try {
          const pageSize = 1000;
          let from = 0;
          const all: Record<string, unknown>[] = [];
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { data, error } = await supabase
              .from(table as never)
              .select("*")
              .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all.push(...(data as Record<string, unknown>[]));
            if (data.length < pageSize) break;
            from += pageSize;
          }
          zip.file(`${table}.csv`, toCsv(all));
          manifest.push({ table, rows: all.length });
        } catch (e) {
          const msg = (e as Error).message;
          zip.file(`${table}.error.txt`, msg);
          manifest.push({ table, rows: 0, error: msg });
        }
      }

      zip.file(
        "manifest.json",
        JSON.stringify(
          { generated_at: new Date().toISOString(), tables: manifest },
          null,
          2,
        ),
      );

      setProgress("Compactando arquivo...");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
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
      setProgress("");
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
            contagem de linhas exportadas. Os dados retornados respeitam as
            permissões (RLS) do usuário atualmente logado.
          </p>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              Para bases grandes, a geração pode levar alguns minutos. Mantenha
              a aba aberta durante o processo.
            </div>
          </div>

          <Button size="lg" onClick={gerarBackup} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress || "Gerando backup..."}
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

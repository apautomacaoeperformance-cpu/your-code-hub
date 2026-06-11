import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Eye, EyeOff, Copy, Check, ShieldAlert, Key, Download,
  Loader2, Code2, Database, AlertTriangle, Info,
} from "lucide-react";

type TableInfo = {
  tablename: string;
  row_count: number;
  column_count: number;
  encrypted_columns: number;
  has_user_id: boolean;
};

type Payload = {
  project_url: string;
  anon_key: string;
  service_role_key: string;
  secrets: Record<string, string>;
  edge_functions: string[];
  edge_functions_count: number;
  database_tables: TableInfo[];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function mask(v: string) {
  if (!v) return "";
  if (v.length <= 25) return v;
  return `${v.slice(0, 12)}•••••${v.slice(-8)}`;
}

function classifyTable(t: TableInfo): "Essencial" | "Histórico" | "Ignorar" {
  const name = t.tablename.toLowerCase();
  if (/(log|audit|auditoria|historico|history)/.test(name)) return "Histórico";
  if (t.row_count === 0) return "Ignorar";
  return "Essencial";
}

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(`${label ?? "Copiado"}!`);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? "Copiar"}
    </Button>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShown((s) => !s)}>
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <CopyBtn value={value} />
        </div>
      </div>
      <code className="break-all font-mono text-xs">{shown ? value : mask(value)}</code>
    </div>
  );
}

export default function PainelMigracao() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);

  async function revelarTudo() {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/painel-migracao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: "{}",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as Payload;
      setData(payload);
      toast.success("Dados de migração carregados");
    } catch (e) {
      toast.error(`Erro ao carregar: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  function copiarTudo() {
    if (!data) return;
    const lines: string[] = [];
    lines.push("═══════════════ CREDENCIAIS ═══════════════");
    lines.push(`PROJECT_URL=${data.project_url}`);
    lines.push(`ANON_KEY=${data.anon_key}`);
    lines.push(`SERVICE_ROLE_KEY=${data.service_role_key}`);
    lines.push("");
    lines.push("═══════════════ SECRETS ═══════════════");
    for (const [k, v] of Object.entries(data.secrets)) lines.push(`${k}=${v}`);
    lines.push("");
    lines.push("═══════════════ EDGE FUNCTIONS ═══════════════");
    data.edge_functions.forEach((n) => lines.push(`- ${n}`));
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Tudo copiado!");
  }

  function baixarEdgeFunctions() {
    const modules = import.meta.glob("/supabase/functions/*/index.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const parts: string[] = [];
    for (const [path, code] of Object.entries(modules)) {
      const name = path.split("/").slice(-2, -1)[0];
      parts.push(`// ═══ ${name} ═══`);
      parts.push(code);
      parts.push("");
    }
    const blob = new Blob([parts.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edge-functions.ts";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${Object.keys(modules).length} funções exportadas`);
  }

  function baixarSecrets() {
    if (!data) return;
    const entries = Object.entries(data.secrets)
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      .join("\n");
    const content = `// Secrets exportados para migração\nexport const SECRETS = {\n${entries}\n} as const;\n\nexport type SecretKey = keyof typeof SECRETS;\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "secrets.ts";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${Object.keys(data.secrets).length} secrets exportados`);
  }

  const extraSecrets = data
    ? Object.entries(data.secrets).filter(
        ([k]) =>
          ![
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_PUBLISHABLE_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_SECRET_KEYS",
            "SUPABASE_PUBLISHABLE_KEYS",
            "SUPABASE_DB_URL",
            "SUPABASE_JWKS",
          ].includes(k),
      )
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Painel de Migração</h1>
        <p className="text-muted-foreground">
          Copie os itens abaixo na ordem e cole na extensão CloneSupa.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={revelarTudo} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          Revelar Tudo
        </Button>
        {data && (
          <Button size="lg" variant="secondary" onClick={copiarTudo}>
            <Copy className="h-4 w-4" /> Copiar Tudo
          </Button>
        )}
      </div>

      {/* Passo 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Passo 1 — Credenciais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data ? (
            <p className="text-sm text-muted-foreground">Clique em "Revelar Tudo".</p>
          ) : (
            <>
              <SecretRow label="Project URL" value={data.project_url} />
              <SecretRow label="Anon Key" value={data.anon_key} />
              <SecretRow label="Service Role Key" value={data.service_role_key} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => { navigator.clipboard.writeText(data.project_url); toast.success("Project URL copiado"); }}>
                  <Copy className="h-4 w-4" /> Copiar Project URL
                </Button>
                <Button variant="destructive" onClick={() => { navigator.clipboard.writeText(data.service_role_key); toast.success("Service Role Key copiado"); }}>
                  <Copy className="h-4 w-4" /> Copiar Service Role Key
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Passo 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Passo 2 — Edge Functions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data ? (
            <div className="flex flex-wrap gap-2">
              {data.edge_functions.map((n) => (
                <Badge key={n} variant="secondary">{n}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando "Revelar Tudo".</p>
          )}
          <Button onClick={baixarEdgeFunctions}>
            <Download className="h-4 w-4" /> Baixar edge-functions.ts
          </Button>
        </CardContent>
      </Card>

      {/* Passo 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Passo 3 — Secrets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data ? (
            <>
              <div className="space-y-2">
                {extraSecrets.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum secret adicional.</p>
                )}
                {extraSecrets.map(([k, v]) => (
                  <SecretRow key={k} label={k} value={v} />
                ))}
              </div>
              <Button onClick={baixarSecrets}>
                <Download className="h-4 w-4" /> Baixar secrets.ts
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando "Revelar Tudo".</p>
          )}
        </CardContent>
      </Card>

      {/* Passo 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Passo 4 — Conferência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data ? (
            <>
              <p className="text-sm">
                <strong>{data.database_tables.length}</strong> tabela(s) no schema <code>public</code>.
              </p>
              <div className="grid gap-2">
                {data.database_tables.map((t) => {
                  const cls = classifyTable(t);
                  const variant =
                    cls === "Essencial" ? "default" : cls === "Histórico" ? "secondary" : "outline";
                  return (
                    <div key={t.tablename} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                      <div>
                        <code className="font-mono">{t.tablename}</code>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t.row_count} linhas · {t.column_count} colunas
                          {t.has_user_id ? " · user_id" : ""}
                        </span>
                      </div>
                      <Badge variant={variant}>{cls}</Badge>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <strong>Sobre senhas:</strong> são copiadas como hash bcrypt. Se o JWT secret do
                  destino mudar, sessões antigas caem — mas as senhas continuam válidas e os
                  usuários podem logar normalmente.
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              Clique em "Revelar Tudo" para listar as tabelas.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Database } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <code className="break-all font-mono text-sm">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export default function Configuracoes() {
  // Extrai a URL e o project ref diretamente do client em uso
  const url = (supabase as any).supabaseUrl as string;
  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Confirme a conexão com o backend atualmente utilizada pela aplicação.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Conexão com o Banco de Dados
            <Badge variant="secondary" className="ml-auto">Ativo</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Project ID" value={projectRef} />
          <Row label="URL Pública" value={url} />
          <Row label="REST API" value={`${url}/rest/v1`} />
          <Row label="Auth" value={`${url}/auth/v1`} />
          <Row label="Edge Functions" value={`${url}/functions/v1`} />
        </CardContent>
      </Card>
    </div>
  );
}

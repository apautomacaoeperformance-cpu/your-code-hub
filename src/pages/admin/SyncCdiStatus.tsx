import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, Clock, MinusCircle, Loader2 } from "lucide-react";

type Execucao = {
  id: string;
  iniciado_em: string;
  finalizado_em: string | null;
  duracao_ms: number | null;
  status: "running" | "success" | "error" | "noop";
  inseridos: number | null;
  periodo_de: string | null;
  periodo_ate: string | null;
  mensagem: string | null;
  erro: string | null;
};

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

const fmtDuracao = (ms: number | null) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)} s`;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1);
  return `${m}m ${rest}s`;
};

const StatusBadge = ({ status }: { status: Execucao["status"] }) => {
  const map = {
    success: { label: "Sucesso", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    error: { label: "Erro", icon: XCircle, className: "bg-destructive/15 text-destructive border-destructive/30" },
    noop: { label: "Sem novidades", icon: MinusCircle, className: "bg-muted text-muted-foreground border-border" },
    running: { label: "Executando", icon: Loader2, className: "bg-primary/15 text-primary border-primary/30" },
  } as const;
  const { label, icon: Icon, className } = map[status];
  return (
    <Badge variant="outline" className={className}>
      <Icon className={`h-3 w-3 mr-1 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
};

export default function SyncCdiStatus() {
  const { data: ultimaSucesso, isLoading: loadingUltima } = useQuery({
    queryKey: ["sync-cdi-ultima-sucesso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_cdi_execucoes" as any)
        .select("*")
        .eq("status", "success")
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Execucao | null;
    },
    refetchInterval: 30_000,
  });

  const { data: execucoes = [], isLoading } = useQuery({
    queryKey: ["sync-cdi-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_cdi_execucoes" as any)
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Execucao[];
    },
    refetchInterval: 30_000,
  });

  const stats = (() => {
    if (!execucoes.length) return null;
    const total = execucoes.length;
    const sucessos = execucoes.filter((e) => e.status === "success").length;
    const erros = execucoes.filter((e) => e.status === "error").length;
    return { total, sucessos, erros };
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Sync BCB — Status
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento das execuções automáticas de sincronização da taxa CDI com a API do Banco Central.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Última execução bem-sucedida
            </div>
            {loadingUltima ? (
              <div className="mt-2 text-sm text-muted-foreground">Carregando…</div>
            ) : ultimaSucesso ? (
              <>
                <div className="mt-1 text-lg font-semibold">{fmtDateTime(ultimaSucesso.iniciado_em)}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Duração: {fmtDuracao(ultimaSucesso.duracao_ms)}
                </div>
                {ultimaSucesso.periodo_de && ultimaSucesso.periodo_ate && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Período: {ultimaSucesso.periodo_de} → {ultimaSucesso.periodo_ate} · {ultimaSucesso.inseridos ?? 0} registros
                  </div>
                )}
              </>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">Nenhuma execução bem-sucedida ainda.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Últimas 50 execuções</div>
            <div className="mt-1 text-lg font-semibold">
              {stats ? `${stats.sucessos}/${stats.total}` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">bem-sucedidas</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Erros recentes</div>
            <div className={`mt-1 text-lg font-semibold ${stats && stats.erros > 0 ? "text-destructive" : ""}`}>
              {stats ? stats.erros : "—"}
            </div>
            <div className="text-xs text-muted-foreground">nas últimas 50 execuções</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Duração</th>
                <th className="px-4 py-3 font-medium text-right">Registros</th>
                <th className="px-4 py-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
              ) : execucoes.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma execução registrada ainda.</td></tr>
              ) : (
                execucoes.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(e.iniciado_em)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3 text-right font-mono">{fmtDuracao(e.duracao_ms)}</td>
                    <td className="px-4 py-3 text-right font-mono">{e.inseridos ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {e.erro ? <span className="text-destructive">{e.erro}</span> : e.mensagem ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

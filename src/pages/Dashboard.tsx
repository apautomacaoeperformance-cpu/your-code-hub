import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Wallet, FileText, ArrowUpRight, FileDown, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportDashboardPDF } from "@/lib/pdf";
import { useAutoInadimplencia } from "@/hooks/useAutoInadimplencia";
import { gerarDocumentoFuncionalidadesPDF } from "@/lib/documentoFuncionalidades";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };
const fmtCurrency = (n: number, lang: string) =>
  n.toLocaleString(localeMap[lang] ?? "pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const statusColor: Record<string, string> = {
  ativa: "bg-success/10 text-success border-success/20",
  liquidada: "bg-muted text-muted-foreground border-border",
  inadimplente: "bg-destructive/10 text-destructive border-destructive/20",
  rascunho: "bg-warning/10 text-warning border-warning/20",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export default function Dashboard() {
  useAutoInadimplencia();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || "pt";
  const fmt = (n: number) => fmtCurrency(n, lang);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [gerandoDoc, setGerandoDoc] = useState(false);

  const handleGerarDoc = async () => {
    setGerandoDoc(true);
    try {
      await gerarDocumentoFuncionalidadesPDF();
    } finally {
      setGerandoDoc(false);
    }
  };

  const { data: opsAll = [] } = useQuery({
    queryKey: ["ops-dash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacoes")
        .select("*, cedentes(razao_social), sacados(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ops = useMemo(() => {
    return opsAll.filter((o: any) => {
      const d = o.data_emissao;
      if (inicio && d < inicio) return false;
      if (fim && d > fim) return false;
      if (status !== "todos" && o.status !== status) return false;
      return true;
    });
  }, [opsAll, inicio, fim, status]);

  const total = ops.reduce((s, o: any) => s + Number(o.valor_principal), 0);
  const ativa = ops.filter((o: any) => o.status === "ativa").reduce((s, o: any) => s + Number(o.valor_principal), 0);
  const inad = ops.filter((o: any) => o.status === "inadimplente").reduce((s, o: any) => s + Number(o.valor_principal), 0);
  const inadPct = total ? (inad / total) * 100 : 0;

  const byMonth: Record<string, number> = {};
  ops.forEach((o: any) => {
    const k = new Date(o.data_emissao).toLocaleDateString(localeMap[lang] ?? "pt-BR", { month: "short" });
    byMonth[k] = (byMonth[k] ?? 0) + Number(o.valor_principal);
  });
  const chartData = Object.entries(byMonth).map(([mes, valor]) => ({ mes, valor }));

  const statusData = ["ativa", "liquidada", "inadimplente"].map((s) => ({
    status: s,
    qtd: ops.filter((o: any) => o.status === s).length,
  }));

  const statusLabel: Record<string, string> = {
    ativa: t("status.active"),
    liquidada: t("status.settled"),
    inadimplente: t("status.overdue"),
    rascunho: t("status.draft"),
    cancelada: t("status.cancelled"),
  };

  const kpis = [
    { label: t("dashboard.portfolioTotal"), value: fmt(total), icon: Wallet, accent: "text-primary" },
    { label: t("dashboard.portfolioActive"), value: fmt(ativa), icon: TrendingUp, accent: "text-success" },
    { label: t("dashboard.defaultRate"), value: `${inadPct.toFixed(1)}%`, sub: fmt(inad), icon: AlertTriangle, accent: "text-destructive" },
    { label: t("dashboard.operations"), value: ops.length.toString(), icon: FileText, accent: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("dashboard.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={handleGerarDoc} 
              disabled={gerandoDoc}
            >
              {gerandoDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Doc. Funcionalidades (PDF)
            </Button>
            <Button onClick={() => exportDashboardPDF(ops as any, { inicio, fim, status })} className="gap-2">
              <FileDown className="h-4 w-4" />{t("common.exportPdf")}
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("dashboard.startEmission")}</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("dashboard.endEmission")}</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("fields.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("status.all")}</SelectItem>
                <SelectItem value="rascunho">{t("status.draft")}</SelectItem>
                <SelectItem value="ativa">{t("status.active")}</SelectItem>
                <SelectItem value="liquidada">{t("status.settled")}</SelectItem>
                <SelectItem value="inadimplente">{t("status.overdue")}</SelectItem>
                <SelectItem value="cancelada">{t("status.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => { setInicio(""); setFim(""); setStatus("todos"); }}>
              {t("common.clearFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/60 shadow-sm transition-smooth hover:shadow-smooth">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${k.accent}`}>{k.value}</p>
                  {k.sub && <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>}
                </div>
                <div className="rounded-lg bg-secondary p-2">
                  <k.icon className={`h-4 w-4 ${k.accent}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border-border/60 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("dashboard.volumeByMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">{t("dashboard.statusChart")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="qtd" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">{t("dashboard.recentOps")}</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">{t("fields.number")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("dashboard.cedente")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("dashboard.sacado")}</th>
                  <th className="px-6 py-3 text-right font-medium">{t("fields.value")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("fields.dueDate")}</th>
                  <th className="px-6 py-3 text-left font-medium">{t("fields.status")}</th>
                </tr>
              </thead>
              <tbody>
                {ops.slice(0, 6).map((o: any) => (
                  <tr key={o.id} className="border-b border-border/60 transition-smooth hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground">{o.numero}</td>
                    <td className="px-6 py-3 text-muted-foreground">{o.cedentes?.razao_social}</td>
                    <td className="px-6 py-3 text-muted-foreground">{o.sacados?.nome}</td>
                    <td className="px-6 py-3 text-right font-medium text-foreground">{fmt(Number(o.valor_principal))}</td>
                    <td className="px-6 py-3 text-muted-foreground">{new Date(o.data_vencimento).toLocaleDateString(localeMap[lang] ?? "pt-BR")}</td>
                    <td className="px-6 py-3">
                      <Badge variant="outline" className={statusColor[o.status]}>{statusLabel[o.status] ?? o.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

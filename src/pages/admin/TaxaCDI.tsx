import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart as LineChartIcon, RefreshCw, Search, X, History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type CdiRow = { data: string; taxa: number };

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function TaxaCDI() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"periodo" | "data">("periodo");
  const [start, setStart] = useState(monthStartIso());
  const [end, setEnd] = useState(todayIso());
  const [singleDate, setSingleDate] = useState(todayIso());
  const [filters, setFilters] = useState<{ start: string; end: string }>({
    start: monthStartIso(),
    end: todayIso(),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cdi-diario", filters.start, filters.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdi_diario")
        .select("data,taxa")
        .gte("data", filters.start)
        .lte("data", filters.end)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CdiRow[];
    },
  });

  const { data: lastUpdate } = useQuery({
    queryKey: ["cdi-diario-last-update"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdi_diario")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.updated_at as string | undefined) ?? null;
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-cdi");
      if (error) throw error;
      return data as { inserted: number; from?: string; to?: string; message?: string };
    },
    onSuccess: (res) => {
      toast.success(t("cdi.syncSuccess", { inserted: res?.inserted ?? 0 }));
      qc.invalidateQueries({ queryKey: ["cdi-diario"] });
      qc.invalidateQueries({ queryKey: ["cdi-diario-last-update"] });
    },
    onError: (e: any) => toast.error(`${t("cdi.syncError")}: ${e.message ?? e}`),
  });

  const applyFilters = () => {
    if (mode === "data") {
      if (!singleDate) return toast.error(t("cdi.invalidDate"));
      setFilters({ start: singleDate, end: singleDate });
    } else {
      if (!start || !end) return toast.error(t("cdi.invalidPeriod"));
      if (start > end) return toast.error(t("cdi.invalidPeriod"));
      setFilters({ start, end });
    }
  };

  const clearFilters = () => {
    const s = monthStartIso();
    const e = todayIso();
    setStart(s);
    setEnd(e);
    setSingleDate(e);
    setFilters({ start: s, end: e });
  };

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(localeMap[i18n.language] ?? "pt-BR");

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const taxas = rows.map((r) => Number(r.taxa));
    const avg = taxas.reduce((a, b) => a + b, 0) / taxas.length;
    const min = Math.min(...taxas);
    const max = Math.max(...taxas);
    return { avg, min, max, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <LineChartIcon className="h-6 w-6" />
            {t("cdi.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("cdi.subtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/auditoria-cdi">
                <History className="h-4 w-4 mr-2" />
                {t("sidebar.auditoriaCdi")}
              </Link>
            </Button>
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? t("cdi.syncing") : t("cdi.sync")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("cdi.lastUpdate")}:{" "}
            {lastUpdate
              ? new Date(lastUpdate).toLocaleString(localeMap[i18n.language] ?? "pt-BR")
              : t("cdi.neverUpdated")}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "periodo" | "data")}>
            <TabsContent value="periodo" className="mt-0">
              <div className="flex flex-wrap items-end gap-3">
                <div><Label className="text-xs opacity-0 select-none">.</Label><TabsList className="h-9">
                  <TabsTrigger value="periodo" className="text-xs px-2 py-1 h-6">{t("cdi.byPeriod")}</TabsTrigger>
                  <TabsTrigger value="data" className="text-xs px-2 py-1 h-6">{t("cdi.byDate")}</TabsTrigger>
                </TabsList></div>
                <div>
                  <Label className="text-xs">{t("cdi.start")}</Label>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">{t("cdi.end")}</Label>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36 h-9 text-sm" />
                </div>
                <Button onClick={applyFilters} variant="default" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  {t("cdi.filter")}
                </Button>
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  {t("cdi.clear")}
                </Button>
              </div>
            </TabsContent>


            <TabsContent value="data" className="mt-0">
              <div className="flex flex-wrap items-end gap-3">
                <div><Label className="text-xs opacity-0 select-none">.</Label><TabsList className="h-9">
                  <TabsTrigger value="periodo" className="text-xs px-2 py-1 h-6">{t("cdi.byPeriod")}</TabsTrigger>
                  <TabsTrigger value="data" className="text-xs px-2 py-1 h-6">{t("cdi.byDate")}</TabsTrigger>
                </TabsList></div>
                <div>
                  <Label className="text-xs">{t("cdi.date")}</Label>
                  <Input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="w-36 h-9 text-sm" />
                </div>
                <Button onClick={applyFilters} variant="default" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  {t("cdi.filter")}
                </Button>
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  {t("cdi.clear")}
                </Button>
              </div>
            </TabsContent>

          </Tabs>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
              <div className="rounded-md border px-3 py-1.5">
                <div className="text-[10px] uppercase text-muted-foreground">{t("cdi.records")}</div>
                <div className="text-sm font-semibold">{stats.count}</div>
              </div>
              <div className="rounded-md border px-3 py-1.5">
                <div className="text-[10px] uppercase text-muted-foreground">{t("cdi.avg")}</div>
                <div className="text-sm font-semibold">{stats.avg.toFixed(6)}%</div>
              </div>
              <div className="rounded-md border px-3 py-1.5">
                <div className="text-[10px] uppercase text-muted-foreground">{t("cdi.min")}</div>
                <div className="text-sm font-semibold">{stats.min.toFixed(6)}%</div>
              </div>
              <div className="rounded-md border px-3 py-1.5">
                <div className="text-[10px] uppercase text-muted-foreground">{t("cdi.max")}</div>
                <div className="text-sm font-semibold">{stats.max.toFixed(6)}%</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">{t("cdi.date")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("cdi.rateDaily")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("cdi.rateAnnual")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t("cdi.empty")}</td></tr>
              ) : (
                rows.map((r) => {
                  const taxaDia = Number(r.taxa);
                  // CDI anual aproximado: (1 + taxa_dia/100)^252 - 1
                  const anual = (Math.pow(1 + taxaDia / 100, 252) - 1) * 100;
                  return (
                    <tr key={r.data} className="border-b last:border-0">
                      <td className="px-4 py-3">{fmtDate(r.data)}</td>
                      <td className="px-4 py-3 text-right font-mono">{taxaDia.toFixed(6)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{anual.toFixed(2)}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

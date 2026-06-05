import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface AccessLog {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  login_at: string;
  last_activity_at: string;
  duration_seconds: number;
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}min`;
};

const formatDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function LogsAcesso() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] ?? "pt-BR";

  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("access_logs")
      .select("id, user_id, user_email, user_name, login_at, last_activity_at, duration_seconds")
      .order("login_at", { ascending: false })
      .limit(500);

    if (from) query = query.gte("login_at", new Date(from + "T00:00:00").toISOString());
    if (to) query = query.lte("login_at", new Date(to + "T23:59:59").toISOString());

    const { data, error } = await query;
    if (!error && data) setLogs(data as AccessLog[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        (l.user_name ?? "").toLowerCase().includes(q) ||
        (l.user_email ?? "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("logsAcesso.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("logsAcesso.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{t("logsAcesso.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="search" className="text-xs">{t("logsAcesso.userSearchLabel")}</Label>
              <Input
                id="search"
                className="h-9"
                placeholder={t("logsAcesso.userSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from" className="text-xs">{t("logsAcesso.from")}</Label>
              <Input
                id="from"
                type="date"
                className="h-9"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to" className="text-xs">{t("logsAcesso.to")}</Label>
              <Input id="to" type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {(search || from || to) && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFrom("");
                  setTo("");
                }}
              >
                {t("logsAcesso.clearFilters")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {t("logsAcesso.records")}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("logsAcesso.empty")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3 h-9">{t("logsAcesso.colUser")}</TableHead>
                  <TableHead className="py-2 px-3 h-9">{t("logsAcesso.colLogin")}</TableHead>
                  <TableHead className="text-right py-2 px-3 h-9">{t("logsAcesso.colDuration")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="py-2 px-3">
                      <div className="font-medium">
                        {log.user_name || log.user_email || log.user_id.slice(0, 8)}
                      </div>
                      {log.user_name && log.user_email && (
                        <div className="text-xs text-muted-foreground">{log.user_email}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3">{formatDateTime(log.login_at, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums py-2 px-3">
                      {formatDuration(log.duration_seconds)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

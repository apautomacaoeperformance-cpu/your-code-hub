import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { History, TrendingDown, TrendingUp } from "lucide-react";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

function monthStartIso() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AuditoriaCDI() {
  const { t, i18n } = useTranslation();
  const [start, setStart] = useState(monthStartIso());
  const [end, setEnd] = useState(todayIso());
  const locale = localeMap[i18n.language] ?? "pt-BR";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cdi-auditoria", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cdi_auditoria")
        .select("id, data, taxa_anterior, taxa_nova, alterado_em")
        .gte("data", start)
        .lte("data", end)
        .order("alterado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">{t("auditoriaCdi.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("auditoriaCdi.subtitle")}</p>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">{t("auditoriaCdi.startDate")}</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t("auditoriaCdi.endDate")}</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("auditoriaCdi.tableTitle")} ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("auditoriaCdi.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">{t("auditoriaCdi.colDate")}</th>
                    <th className="text-right">{t("auditoriaCdi.colPrev")}</th>
                    <th className="text-right">{t("auditoriaCdi.colNew")}</th>
                    <th className="text-right">{t("auditoriaCdi.colDelta")}</th>
                    <th className="text-right">{t("auditoriaCdi.colChangedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const delta = Number(r.taxa_nova) - Number(r.taxa_anterior);
                    const up = delta > 0;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2">
                          {new Date(r.data + "T00:00:00").toLocaleDateString(locale)}
                        </td>
                        <td className="text-right tabular-nums">{Number(r.taxa_anterior).toFixed(6)}%</td>
                        <td className="text-right tabular-nums">{Number(r.taxa_nova).toFixed(6)}%</td>
                        <td className="text-right">
                          <Badge variant={up ? "default" : "secondary"} className="gap-1">
                            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {(delta > 0 ? "+" : "") + delta.toFixed(6)}
                          </Badge>
                        </td>
                        <td className="text-right text-xs text-muted-foreground">
                          {new Date(r.alterado_em).toLocaleString(locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

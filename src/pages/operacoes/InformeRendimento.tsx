import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileText, RefreshCw, Calendar } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { previewPdf } from "@/lib/pdfPreview";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function InformeRendimento() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.resolvedLanguage || "pt"] || "pt-BR";
  const fmt = (n: number) =>
    Number(n || 0).toLocaleString(locale, { style: "currency", currency: "BRL" });

  const meses = t("informeRendimento.months", { returnObjects: true }) as string[];

  const qc = useQueryClient();
  const hoje = new Date();
  const [anoSel, setAnoSel] = useState<number>(hoje.getFullYear() - 1);
  const [mesSel, setMesSel] = useState<number>(hoje.getMonth() === 0 ? 12 : hoje.getMonth());
  const [anoSnap, setAnoSnap] = useState<number>(
    hoje.getMonth() === 0 ? hoje.getFullYear() - 1 : hoje.getFullYear()
  );
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [loadingInf, setLoadingInf] = useState(false);

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ["informes", anoSel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("informes_rendimento")
        .select("*, debenturista:debenturista_id(nome,documento,tipo), debenture:debenture_id(nome)")
        .eq("ano_calendario", anoSel)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(
    () =>
      informes.reduce(
        (a: any, r: any) => ({
          bruto: a.bruto + Number(r.total_rendimento_bruto || 0),
          ir: a.ir + Number(r.valor_ir_retido || r.total_ir_retido || 0),
          liquido: a.liquido + Number(r.total_rendimento_liquido || 0),
          saldo: a.saldo + Number(r.saldo_em_31_12 || 0),
        }),
        { bruto: 0, ir: 0, liquido: 0, saldo: 0 }
      ),
    [informes]
  );

  const gerarSnapshots = async () => {
    setLoadingSnap(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-rendimentos-mensais", {
        body: { ano: anoSnap, mes: mesSel },
      });
      if (error) throw error;
      toast.success(
        t("informeRendimento.snapshotsCreated", {
          n: data?.criados ?? 0,
          month: meses[mesSel - 1],
          year: anoSnap,
        })
      );
    } catch (e: any) {
      toast.error(e.message || t("informeRendimento.snapshotsError"));
    } finally {
      setLoadingSnap(false);
    }
  };

  const gerarInformes = async () => {
    setLoadingInf(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-informe-anual", {
        body: { ano: anoSel },
      });
      if (error) throw error;
      toast.success(
        t("informeRendimento.informesCreated", { n: data?.criados ?? 0, year: anoSel })
      );
      qc.invalidateQueries({ queryKey: ["informes", anoSel] });
    } catch (e: any) {
      toast.error(e.message || t("informeRendimento.informesError"));
    } finally {
      setLoadingInf(false);
    }
  };

  const baixarPDF = (r: any) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("JHL SECURITIZADORA", 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${t("informeRendimento.title")} · ${t("informeRendimento.calendarYear")} ${r.ano_calendario}`, 14, 19);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(r.debenturista?.nome || "—", 14, 40);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `${r.debenturista?.tipo || ""} · ${r.debenturista?.documento || ""}`,
      14,
      46
    );
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 54,
      head: [[t("fields.description"), t("fields.value")]],
      body: [
        [t("sidebar.debentures"), r.debenture?.nome || "—"],
        [t("informeRendimento.colSaldo"), fmt(Number(r.saldo_em_31_12 || 0))],
        [t("informeRendimento.colBruto"), fmt(Number(r.total_rendimento_bruto || 0))],
        [t("informeRendimento.colIR"), fmt(Number(r.total_ir_retido || 0))],
        [t("informeRendimento.colLiquido"), fmt(Number(r.total_rendimento_liquido || 0))],
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${t("common.create")}: ${new Date().toLocaleString(locale)}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
    previewPdf(doc, `informe_${r.ano_calendario}_${(r.debenturista?.nome || "x").replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("informeRendimento.title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("informeRendimento.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> {t("informeRendimento.snapshots")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t("informeRendimento.month")}</Label>
                <Select value={String(mesSel)} onValueChange={(v) => setMesSel(Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("informeRendimento.year")}</Label>
                <Input
                  type="number"
                  value={anoSnap}
                  onChange={(e) => setAnoSnap(Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <Button onClick={gerarSnapshots} disabled={loadingSnap} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingSnap ? "animate-spin" : ""}`} />
                {t("informeRendimento.generateSnapshots")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("informeRendimento.snapshotsDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("informeRendimento.annualConsolidation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">{t("informeRendimento.calendarYear")}</Label>
              <Input
                type="number"
                value={anoSel}
                onChange={(e) => setAnoSel(Number(e.target.value))}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex justify-center">
              <Button onClick={gerarInformes} disabled={loadingInf} size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingInf ? "animate-spin" : ""}`} />
                {t("informeRendimento.consolidate")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("informeRendimento.consolidateDesc")}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("informeRendimento.reports")} — {anoSel}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : informes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("informeRendimento.noneFor", { year: anoSel })}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("informeRendimento.colDebenturista")}</TableHead>
                  <TableHead>{t("informeRendimento.colDebenture")}</TableHead>
                  <TableHead className="text-right">{t("informeRendimento.colSaldo")}</TableHead>
                  <TableHead className="text-right">{t("informeRendimento.colBruto")}</TableHead>
                  <TableHead className="text-right">{t("informeRendimento.colIR")}</TableHead>
                  <TableHead className="text-right">{t("informeRendimento.colLiquido")}</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {informes.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{r.debenturista?.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.debenturista?.documento}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.debenture?.nome || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(Number(r.saldo_em_31_12 || 0))}</TableCell>
                    <TableCell className="text-right text-sm text-success">{fmt(Number(r.total_rendimento_bruto || 0))}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{fmt(Number(r.total_ir_retido || 0))}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-success">{fmt(Number(r.total_rendimento_liquido || 0))}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => baixarPDF(r)}>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={2}>{t("informeRendimento.total")} ({informes.length})</TableCell>
                  <TableCell className="text-right">{fmt(totals.saldo)}</TableCell>
                  <TableCell className="text-right text-success">{fmt(totals.bruto)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(totals.ir)}</TableCell>
                  <TableCell className="text-right text-success">{fmt(totals.liquido)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

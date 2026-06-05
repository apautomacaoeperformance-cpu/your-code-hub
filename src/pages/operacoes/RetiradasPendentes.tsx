import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { calcRendimento, aliquotaIR, type CdiMap } from "@/lib/debentureCalc";
import { Calendar, CheckCircle2, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addMonths(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return toIso(d);
}

type PendingRow = {
  key: string;
  venda_id: string;
  debenturista: string;
  debenture: string;
  tipo_retirada: "mensal" | "semestral";
  data_venda: string;
  data_prevista: string;
  inicio_periodo: string; // exclusivo (data da última retirada ou data_venda)
  valor_principal: number;
  rendimento_bruto: number;
  aliquota_ir: number;
  ir: number;
  liquido: number;
  vencida: boolean;
};

export default function RetiradasPendentes() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const locale = localeMap[i18n.language] ?? "pt-BR";
  const fmt = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString(locale) : "-");

  const [periodo, setPeriodo] = useState<"semestral" | "todas">("semestral");
  const [janelaDias, setJanelaDias] = useState(30);
  const [dialogVenda, setDialogVenda] = useState<PendingRow | null>(null);
  const [caixaId, setCaixaId] = useState<string>("");
  const [dataConfirm, setDataConfirm] = useState<string>("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Carrega vendas com debenture e debenturista
  const { data: vendas = [] } = useQuery({
    queryKey: ["retiradas-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendas_debenture")
        .select(`
          id, valor, data_venda, debenture_id, debenturista_id,
          debenture:debenture_id(id, nome, tipo_taxa, rentabilidade_anual, tipo_retirada, data_vencimento),
          debenturista:debenturista_id(nome)
        `);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Retiradas já realizadas (para descobrir a última de cada venda)
  const { data: retiradas = [] } = useQuery({
    queryKey: ["retiradas-feitas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retiradas_debenture")
        .select("venda_id, data_retirada, tipo")
        .eq("tipo", "rendimento")
        .order("data_retirada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // CDI
  const { data: cdiRows = [] } = useQuery({
    queryKey: ["retiradas-cdi"],
    queryFn: async () => {
      const inicio = new Date();
      inicio.setFullYear(inicio.getFullYear() - 3);
      const { data, error } = await supabase
        .from("cdi_diario").select("data, taxa").gte("data", toIso(inicio));
      if (error) throw error;
      return data ?? [];
    },
  });
  const cdi: CdiMap = useMemo(
    () => new Map(cdiRows.map((r: any) => [r.data as string, Number(r.taxa)])),
    [cdiRows],
  );

  // Feriados
  const { data: feriadosRows = [] } = useQuery({
    queryKey: ["retiradas-feriados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feriados").select("data");
      if (error) throw error;
      return data ?? [];
    },
  });
  const feriados = useMemo(
    () => new Set(feriadosRows.map((r: any) => r.data as string)),
    [feriadosRows],
  );

  const { data: caixas = [] } = useQuery({
    queryKey: ["retiradas-caixas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixas").select("id, nome, saldo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Última retirada por venda
  const ultimaPorVenda = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of retiradas as any[]) {
      if (!map.has(r.venda_id)) map.set(r.venda_id, r.data_retirada);
    }
    return map;
  }, [retiradas]);

  // Calcula próxima data prevista a partir de data_venda + N meses, pulando os já pagos
  const computeNext = (dataVenda: string, intervaloMeses: number, ultimaPaga?: string): string => {
    let prox = addMonths(dataVenda, intervaloMeses);
    if (!ultimaPaga) return prox;
    while (prox <= ultimaPaga) prox = addMonths(prox, intervaloMeses);
    return prox;
  };

  const hojeIso = toIso(new Date());
  const limiteIso = toIso(new Date(Date.now() + janelaDias * 86400000));

  const linhas: PendingRow[] = useMemo(() => {
    const result: PendingRow[] = [];
    for (const v of vendas as any[]) {
      const tipoRet = (v.debenture?.tipo_retirada || "final") as string;
      if (tipoRet !== "mensal" && tipoRet !== "semestral") continue;
      if (periodo !== "todas" && periodo !== tipoRet) continue;

      const intervalo = tipoRet === "semestral" ? 6 : 1;
      const ultima = ultimaPorVenda.get(v.id);
      const dataPrev = computeNext(v.data_venda, intervalo, ultima);

      // Limita ao vencimento da debenture
      if (v.debenture?.data_vencimento && dataPrev > v.debenture.data_vencimento) continue;
      if (dataPrev > limiteIso) continue;

      const inicio = ultima || v.data_venda;
      const valor = Number(v.valor || 0);
      const rentAnual = Number(v.debenture?.rentabilidade_anual || 0);
      const tipoTaxa = String(v.debenture?.tipo_taxa || "FIXA").toUpperCase();
      const fimDate = new Date(dataPrev + "T00:00:00");

      const bruto = calcRendimento(valor, rentAnual, 0, {
        tipoTaxa, cdi, dataVenda: inicio, ate: fimDate, feriados,
      });
      if (bruto <= 0) continue;

      const diasDesdeVenda = Math.floor(
        (fimDate.getTime() - new Date(v.data_venda + "T00:00:00").getTime()) / 86400000,
      );
      const aliq = aliquotaIR(diasDesdeVenda);
      const ir = Number((bruto * (aliq / 100)).toFixed(2));
      const liq = Number((bruto - ir).toFixed(2));

      result.push({
        key: v.id,
        venda_id: v.id,
        debenturista: v.debenturista?.nome || "-",
        debenture: v.debenture?.nome || "-",
        tipo_retirada: tipoRet as "mensal" | "semestral",
        data_venda: v.data_venda,
        data_prevista: dataPrev,
        inicio_periodo: inicio,
        valor_principal: valor,
        rendimento_bruto: Number(bruto.toFixed(2)),
        aliquota_ir: aliq,
        ir,
        liquido: liq,
        vencida: dataPrev < hojeIso,
      });
    }
    return result.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  }, [vendas, ultimaPorVenda, periodo, janelaDias, cdi, feriados, limiteIso, hojeIso]);

  const totais = useMemo(() => ({
    qtd: linhas.length,
    bruto: linhas.reduce((s, r) => s + r.rendimento_bruto, 0),
    ir: linhas.reduce((s, r) => s + r.ir, 0),
    liquido: linhas.reduce((s, r) => s + r.liquido, 0),
  }), [linhas]);

  const openConfirm = (row: PendingRow) => {
    setDialogVenda(row);
    setDataConfirm(row.data_prevista);
    setCaixaId(caixas[0]?.id || "");
    setObs("");
  };

  const efetivar = async () => {
    if (!dialogVenda || !caixaId) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("efetivar-retirada-juros", {
        body: {
          venda_id: dialogVenda.venda_id,
          data_retirada: dataConfirm,
          caixa_id: caixaId,
          observacoes: obs || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(t("retiradasPendentes.success"));
      setDialogVenda(null);
      qc.invalidateQueries({ queryKey: ["retiradas-feitas"] });
      qc.invalidateQueries({ queryKey: ["retiradas-caixas"] });
    } catch (e: any) {
      toast.error(e?.message || t("retiradasPendentes.error"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">{t("retiradasPendentes.title")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{t("retiradasPendentes.subtitle")}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("retiradasPendentes.totalPendentes")}</p>
          <p className="text-2xl font-semibold">{totais.qtd}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("retiradasPendentes.totalBruto")}</p>
          <p className="text-xl font-semibold tabular-nums">R$ {fmt(totais.bruto)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("retiradasPendentes.totalIR")}</p>
          <p className="text-xl font-semibold tabular-nums">R$ {fmt(totais.ir)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t("retiradasPendentes.totalLiquido")}</p>
          <p className="text-xl font-semibold tabular-nums text-primary">R$ {fmt(totais.liquido)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">{t("retiradasPendentes.tipo")}</Label>
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
              <TabsList>
                <TabsTrigger value="semestral">{t("retiradasPendentes.semestral")}</TabsTrigger>
                <TabsTrigger value="todas">{t("retiradasPendentes.todas")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label className="text-xs">{t("retiradasPendentes.janela")}</Label>
            <Select value={String(janelaDias)} onValueChange={(v) => setJanelaDias(Number(v))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 {t("retiradasPendentes.dias")}</SelectItem>
                <SelectItem value="15">15 {t("retiradasPendentes.dias")}</SelectItem>
                <SelectItem value="30">30 {t("retiradasPendentes.dias")}</SelectItem>
                <SelectItem value="60">60 {t("retiradasPendentes.dias")}</SelectItem>
                <SelectItem value="180">180 {t("retiradasPendentes.dias")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("retiradasPendentes.lista")}</CardTitle>
        </CardHeader>
        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("retiradasPendentes.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">{t("retiradasPendentes.colDebenturista")}</th>
                    <th className="text-left">{t("retiradasPendentes.colDebenture")}</th>
                    <th className="text-left">{t("retiradasPendentes.colTipo")}</th>
                    <th className="text-left">{t("retiradasPendentes.colData")}</th>
                    <th className="text-right">{t("retiradasPendentes.colPrincipal")}</th>
                    <th className="text-right">{t("retiradasPendentes.colBruto")}</th>
                    <th className="text-right">{t("retiradasPendentes.colIR")}</th>
                    <th className="text-right">{t("retiradasPendentes.colLiquido")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((r) => (
                    <tr key={r.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2">{r.debenturista}</td>
                      <td>{r.debenture}</td>
                      <td>
                        <Badge variant="secondary" className="capitalize">{r.tipo_retirada}</Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {fmtDate(r.data_prevista)}
                          {r.vencida && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {t("retiradasPendentes.vencida")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{fmt(r.valor_principal)}</td>
                      <td className="text-right tabular-nums">{fmt(r.rendimento_bruto)}</td>
                      <td className="text-right tabular-nums text-muted-foreground">
                        {fmt(r.ir)} <span className="text-xs">({r.aliquota_ir}%)</span>
                      </td>
                      <td className="text-right tabular-nums font-semibold text-primary">{fmt(r.liquido)}</td>
                      <td className="text-right">
                        <Button size="sm" onClick={() => openConfirm(r)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t("retiradasPendentes.efetivar")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialogVenda} onOpenChange={(v) => !v && setDialogVenda(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("retiradasPendentes.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {dialogVenda?.debenturista} — {dialogVenda?.debenture}
            </DialogDescription>
          </DialogHeader>
          {dialogVenda && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("retiradasPendentes.colBruto")}</p>
                  <p className="tabular-nums font-medium">R$ {fmt(dialogVenda.rendimento_bruto)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    IR ({dialogVenda.aliquota_ir}%)
                  </p>
                  <p className="tabular-nums font-medium">R$ {fmt(dialogVenda.ir)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("retiradasPendentes.colLiquido")}</p>
                  <p className="tabular-nums font-semibold text-primary">R$ {fmt(dialogVenda.liquido)}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">{t("retiradasPendentes.dataRetirada")}</Label>
                <Input type="date" value={dataConfirm} onChange={(e) => setDataConfirm(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> {t("retiradasPendentes.caixa")}
                </Label>
                <Select value={caixaId} onValueChange={setCaixaId}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {caixas.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} — R$ {fmt(Number(c.saldo))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("retiradasPendentes.obs")}</Label>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="..." />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("retiradasPendentes.recalcInfo")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogVenda(null)} disabled={salvando}>
              {t("common.cancel")}
            </Button>
            <Button onClick={efetivar} disabled={salvando || !caixaId}>
              {salvando ? t("common.saving") : t("retiradasPendentes.confirmar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

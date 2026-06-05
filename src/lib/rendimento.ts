import type { FeriadosSet } from "@/lib/diasUteis";

/**
 * Fonte única da verdade para o cálculo de rendimentos de debêntures.
 * Usado tanto na tela de detalhe quanto nos relatórios consolidados,
 * garantindo que todos os números batam entre si.
 *
 * FIXA: capitalização diária composta via (1 + rentAnual)^(1/252) — base 252 dias úteis.
 * CDI : produto((1 + cdi_dia/100)^(rent/100)) sobre os dias úteis. rent = % do CDI (ex: 110 -> 1.10).
 */

export type CdiMap = Map<string, number>; // isoDate -> % ao dia (BCB SGS 12)

export const isoAdd = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const toIso = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);

export type CalcOpts = {
  tipoTaxa?: string;
  cdi?: CdiMap;
  dataVenda?: string;
  ate?: Date;
  feriados?: FeriadosSet;
};

// Rendimento bruto acumulado de uma aplicação até a data `ate` (padrão: hoje).
export const calcRendimento = (valor: number, rentAnual: number, du: number, opts?: CalcOpts) => {
  if (!valor) return 0;
  if (opts?.tipoTaxa === "CDI" && opts.cdi && opts.dataVenda) {
    const pctCDI = (rentAnual || 100) / 100;
    const endIso = toIso(opts.ate ?? new Date());
    let cur = isoAdd(opts.dataVenda, 1);
    let fator = 1;
    // Inicializa lastCdi com a taxa mais recente disponível <= cur,
    // pois o CDI do dia D normalmente só é publicado em D+1.
    let lastCdi = 0;
    const sortedDates = Array.from(opts.cdi.keys()).sort();
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      if (sortedDates[i] <= cur) {
        lastCdi = opts.cdi.get(sortedDates[i]) || 0;
        break;
      }
    }
    while (cur <= endIso) {
      const dow = new Date(cur + "T00:00:00").getDay();
      const isHoliday = opts.feriados?.has(cur);
      if (dow !== 0 && dow !== 6 && !isHoliday) {
        const t = opts.cdi.get(cur);
        if (t != null) lastCdi = t;
        const usar = t ?? lastCdi;
        if (usar > 0) fator *= Math.pow(1 + usar / 100, pctCDI);
      }
      cur = isoAdd(cur, 1);
    }
    return valor * (fator - 1);
  }
  if (!rentAnual || !du) return 0;
  const taxaDiaria = Math.pow(1 + rentAnual / 100, 1 / 252) - 1;
  return valor * (Math.pow(1 + taxaDiaria, du) - 1);
};

// IR regressivo (renda fixa) por dias corridos desde a aplicação
export const aliquotaIR = (diasCorridos: number) => {
  if (diasCorridos <= 180) return 22.5;
  if (diasCorridos <= 360) return 20;
  if (diasCorridos <= 720) return 17.5;
  return 15;
};

export const diasCorridos = (dataVenda?: string, ate: Date = new Date()) => {
  if (!dataVenda) return 0;
  const ini = new Date(dataVenda + "T00:00:00");
  return Math.max(0, Math.floor((ate.getTime() - ini.getTime()) / 86400000));
};

export const calcLiquido = (rendBruto: number, dataVenda?: string, ate?: Date) => {
  if (rendBruto <= 0) return rendBruto;
  return rendBruto * (1 - aliquotaIR(diasCorridos(dataVenda, ate)) / 100);
};

// Rendimento de 1 dia útil (coluna "Rend. Diário")
export const calcRendDiario = (valor: number, rentAnual: number, opts?: CalcOpts) => {
  if (!valor) return 0;
  if (opts?.tipoTaxa === "CDI" && opts.cdi && opts.cdi.size) {
    const pctCDI = (rentAnual || 100) / 100;
    const lastIso = Array.from(opts.cdi.keys()).sort().pop()!;
    const cdi = opts.cdi.get(lastIso) || 0;
    return valor * (Math.pow(1 + cdi / 100, pctCDI) - 1);
  }
  if (!rentAnual) return 0;
  const taxaDiaria = Math.pow(1 + rentAnual / 100, 1 / 252) - 1;
  return valor * taxaDiaria;
};

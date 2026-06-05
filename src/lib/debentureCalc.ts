import type { FeriadosSet } from "@/lib/diasUteis";
import { diasUteis as diasUteisFn } from "@/lib/diasUteis";

export type CdiMap = Map<string, number>;

export type CalcOpts = {
  tipoTaxa?: string;
  cdi?: CdiMap;
  dataVenda?: string;
  ate?: Date;
  feriados?: FeriadosSet;
};

const isoAdd = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const toIso = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);

export const calcRendimento = (valor: number, rentAnual: number, du: number, opts?: CalcOpts) => {
  if (!valor) return 0;
  if (opts?.tipoTaxa === "CDI" && opts.cdi && opts.dataVenda) {
    const pctCDI = (rentAnual || 100) / 100;
    const endIso = toIso(opts.ate ?? new Date());
    let cur = isoAdd(opts.dataVenda, 1);
    let fator = 1;
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

export const calcIR = (rendBruto: number, dataVenda?: string, ate?: Date) => {
  if (rendBruto <= 0) return 0;
  return rendBruto * (aliquotaIR(diasCorridos(dataVenda, ate)) / 100);
};

export const calcLiquido = (rendBruto: number, dataVenda?: string, ate?: Date) => {
  if (rendBruto <= 0) return rendBruto;
  return rendBruto - calcIR(rendBruto, dataVenda, ate);
};

export const diasUteisHelper = (from: string, to: Date, feriados?: FeriadosSet) =>
  diasUteisFn(from, to, feriados);

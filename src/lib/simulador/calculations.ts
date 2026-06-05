export interface SimInput {
  valorInicial: number;
  aporteMensal: number;
  prazoMeses: number;
  cdiAnual: number;
  percentualCDI: number;
  taxaPrefixadaAnual: number;
}

export interface SerieMes {
  mes: number;
  cdi: number;
  prefixado: number;
  poupanca: number;
  totalInvestido: number;
}

export interface SimOutput {
  montanteBruto: number;
  totalInvestido: number;
  rendimentoBruto: number;
  ir: number;
  montanteLiquido: number;
  rentLiquidaTotalPct: number;
  rentLiquidaAaPct: number;
}

export interface SimResult {
  cdi: SimOutput;
  prefixado: SimOutput;
  poupanca: SimOutput;
  serie: SerieMes[];
  breakEvenCdiAnual: number | null;
}

export const aaToAm = (taxaAnual: number) => Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;

export function aliquotaIR(prazoMeses: number): number {
  const dias = prazoMeses * 30;
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.20;
  if (dias <= 720) return 0.175;
  return 0.15;
}

function evolui(
  valorInicial: number,
  aporte: number,
  meses: number,
  taxaMensal: number,
): { saldoFinal: number; saldos: number[] } {
  let saldo = valorInicial;
  const saldos: number[] = [saldo];
  for (let i = 1; i <= meses; i++) {
    saldo = (saldo + aporte) * (1 + taxaMensal);
    saldos.push(saldo);
  }
  return { saldoFinal: saldo, saldos };
}

function montaOutput(
  bruto: number,
  totalInvestido: number,
  prazoMeses: number,
): SimOutput {
  const rendimentoBruto = bruto - totalInvestido;
  const ir = rendimentoBruto > 0 ? rendimentoBruto * aliquotaIR(prazoMeses) : 0;
  const liquido = bruto - ir;
  const rentTotal = totalInvestido > 0 ? (liquido / totalInvestido - 1) * 100 : 0;
  const anos = prazoMeses / 12;
  const rentAa = anos > 0 && liquido > 0 && totalInvestido > 0
    ? (Math.pow(liquido / totalInvestido, 1 / anos) - 1) * 100
    : 0;
  return {
    montanteBruto: bruto,
    totalInvestido,
    rendimentoBruto,
    ir,
    montanteLiquido: liquido,
    rentLiquidaTotalPct: rentTotal,
    rentLiquidaAaPct: rentAa,
  };
}

export function simular(input: SimInput): SimResult {
  const { valorInicial, aporteMensal, prazoMeses, cdiAnual, percentualCDI, taxaPrefixadaAnual } = input;

  const taxaCdiAa = (cdiAnual * percentualCDI) / 100;
  const taxaCdiAm = aaToAm(taxaCdiAa);
  const taxaPreAm = aaToAm(taxaPrefixadaAnual);
  const taxaPoupAa = cdiAnual * 0.7;
  const taxaPoupAm = aaToAm(taxaPoupAa);

  const evCdi = evolui(valorInicial, aporteMensal, prazoMeses, taxaCdiAm);
  const evPre = evolui(valorInicial, aporteMensal, prazoMeses, taxaPreAm);
  const evPoup = evolui(valorInicial, aporteMensal, prazoMeses, taxaPoupAm);

  const totalInvestido = valorInicial + aporteMensal * prazoMeses;

  const serie: SerieMes[] = [];
  for (let m = 0; m <= prazoMeses; m++) {
    serie.push({
      mes: m,
      cdi: evCdi.saldos[m],
      prefixado: evPre.saldos[m],
      poupanca: evPoup.saldos[m],
      totalInvestido: valorInicial + aporteMensal * m,
    });
  }

  const cdiOut = montaOutput(evCdi.saldoFinal, totalInvestido, prazoMeses);
  const preOut = montaOutput(evPre.saldoFinal, totalInvestido, prazoMeses);
  const poupOut = montaOutput(evPoup.saldoFinal, totalInvestido, prazoMeses);

  // Break-even: qual CDI anual (com mesmo percentualCDI) faz líquido CDI == líquido Prefixado
  const liqPre = preOut.montanteLiquido;
  let lo = 0, hi = 30, mid = 0, found: number | null = null;
  for (let i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    const tx = aaToAm((mid * percentualCDI) / 100);
    const saldo = evolui(valorInicial, aporteMensal, prazoMeses, tx).saldoFinal;
    const out = montaOutput(saldo, totalInvestido, prazoMeses);
    if (Math.abs(out.montanteLiquido - liqPre) < 0.01) { found = mid; break; }
    if (out.montanteLiquido < liqPre) lo = mid; else hi = mid;
  }
  if (found === null && mid > 0 && mid < 30) found = mid;

  return {
    cdi: cdiOut,
    prefixado: preOut,
    poupanca: poupOut,
    serie,
    breakEvenCdiAnual: found,
  };
}

export function simularCenarios(input: SimInput) {
  return {
    cai: simular({ ...input, cdiAnual: Math.max(0, input.cdiAnual - 2) }),
    estavel: simular(input),
    sobe: simular({ ...input, cdiAnual: input.cdiAnual + 2 }),
  };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FeriadosSet = Set<string>; // ISO yyyy-mm-dd

const isWeekend = (d: Date) => {
  const w = d.getDay();
  return w === 0 || w === 6;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Dias úteis entre datas (exclusivo no início, inclusivo no fim).
 * Pula sábados, domingos e feriados cadastrados.
 */
export function diasUteis(
  from: string | Date,
  to: string | Date = new Date(),
  feriados?: FeriadosSet,
): number {
  const start = typeof from === "string" ? new Date(from + "T00:00:00") : new Date(from);
  const endD = typeof to === "string" ? new Date(to + "T00:00:00") : to;
  const end = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
  if (end <= start) return 0;
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    if (!isWeekend(cur) && !(feriados && feriados.has(toIso(cur)))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Retorna uma função diasUteis pré-configurada com o conjunto de feriados. */
export function makeDiasUteis(feriados?: FeriadosSet) {
  return (from: string | Date, to: string | Date = new Date()) =>
    diasUteis(from, to, feriados);
}

/**
 * Retorna o próximo dia útil (yyyy-mm-dd) a partir de `from` (inclusive).
 * Se `from` já for dia útil, retorna a própria data.
 */
export function proximoDiaUtil(from: string | Date = new Date(), feriados?: FeriadosSet): string {
  const d = typeof from === "string" ? new Date(from + "T00:00:00") : new Date(from);
  const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (isWeekend(cur) || (feriados && feriados.has(toIso(cur)))) {
    cur.setDate(cur.getDate() + 1);
  }
  return toIso(cur);
}

/**
 * Verifica se uma data (yyyy-mm-dd) é dia útil.
 * Retorna true se não for fim de semana nem feriado.
 */
export function isDiaUtil(iso: string, feriados?: FeriadosSet): boolean {
  const d = new Date(iso + "T00:00:00");
  return !isWeekend(d) && !(feriados && feriados.has(toIso(d)));
}


export function useFeriados() {
  return useQuery({
    queryKey: ["feriados"],
    queryFn: async (): Promise<FeriadosSet> => {
      const { data, error } = await supabase.from("feriados").select("data");
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.data as string));
    },
    staleTime: 5 * 60 * 1000,
  });
}

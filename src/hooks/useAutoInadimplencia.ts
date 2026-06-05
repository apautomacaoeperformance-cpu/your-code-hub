import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Dispara, ao montar, a rotina do banco que marca como
 * inadimplente toda operação ativa cujo vencimento já passou.
 */
export function useAutoInadimplencia() {
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("marcar_inadimplentes");
      if (cancelled) return;
      if (error) return;
      const n = Number(data ?? 0);
      if (n > 0) {
        toast.warning(
          `${n} operação(ões) marcada(s) como inadimplente automaticamente`,
        );
        qc.invalidateQueries({ queryKey: ["operacoes"] });
        qc.invalidateQueries({ queryKey: ["ops-dash"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc]);
}

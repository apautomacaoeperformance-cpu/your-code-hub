import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Ao montar, executa a rotina do banco que muda para "suspenso"
 * toda debênture ativa cuja data de vencimento já passou.
 */
export function useAutoSuspenderDebentures() {
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("suspender_debentures_vencidas");
      if (cancelled || error) return;
      const n = Number(data ?? 0);
      if (n > 0) {
        toast.warning(`${n} debênture(s) vencida(s) marcada(s) como suspensa(s)`);
        qc.invalidateQueries({ queryKey: ["debentures"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc]);
}

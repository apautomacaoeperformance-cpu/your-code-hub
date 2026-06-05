import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const ACTIVITY_PING_MS = 60_000; // a cada 1 min
const STORAGE_KEY = "access_log_id";

// Guard em escopo de módulo — evita race condition entre múltiplas
// execuções do effect (StrictMode + múltiplos eventos de auth).
let creatingFor: string | null = null;
let activeLogId: string | null = null;
let activeUserId: string | null = null;

export function useAccessLogger() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const logIdRef = useRef<string | null>(null);
  const loginAtRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!userId || !user) {
      logIdRef.current = null;
      loginAtRef.current = null;
      activeLogId = null;
      activeUserId = null;
      creatingFor = null;
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    let cancelled = false;

    const start = async () => {
      // Já temos log ativo para este usuário em memória
      if (activeUserId === userId && activeLogId) {
        logIdRef.current = activeLogId;
        loginAtRef.current = loginAtRef.current ?? new Date();
        return;
      }

      // sessionStorage (caso recarregue a página)
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) {
        logIdRef.current = existing;
        loginAtRef.current = new Date();
        activeLogId = existing;
        activeUserId = userId;
        return;
      }

      // Já existe criação em andamento para este usuário
      if (creatingFor === userId) return;
      creatingFor = userId;

      const meta = (user.user_metadata ?? null) as Record<string, unknown> | null;
      const fullName =
        ((meta?.full_name as string | undefined) ?? (meta?.name as string | undefined)) ?? null;

      const { data, error } = await supabase
        .from("access_logs")
        .insert({
          user_id: user.id,
          user_email: user.email ?? null,
          user_name: fullName,
          user_agent: navigator.userAgent,
        })
        .select("id, login_at")
        .single();

      creatingFor = null;
      if (cancelled || error || !data) return;
      logIdRef.current = data.id;
      loginAtRef.current = new Date(data.login_at);
      activeLogId = data.id;
      activeUserId = userId;
      sessionStorage.setItem(STORAGE_KEY, data.id);
    };

    start();

    const ping = async () => {
      const id = logIdRef.current ?? activeLogId;
      const loginAt = loginAtRef.current;
      if (!id || !loginAt) return;
      const now = new Date();
      const duration = Math.max(0, Math.floor((now.getTime() - loginAt.getTime()) / 1000));
      await supabase
        .from("access_logs")
        .update({ last_activity_at: now.toISOString(), duration_seconds: duration })
        .eq("id", id);
    };

    const interval = window.setInterval(ping, ACTIVITY_PING_MS);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
      ping();
    };
  }, [userId, user]);
}

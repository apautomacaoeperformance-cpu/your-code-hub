import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "admin" | "gestor" | "operador" | "investidor";

// Tempo máximo de inatividade antes do logout automático (segurança).
const INACTIVITY_LIMIT_MS = 7 * 60 * 1000; // 7 minutos

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  mustChangePassword: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Força logout quando o usuário fecha o navegador/aba sem clicar em "Sair".
    // sessionStorage é limpo ao fechar a aba/navegador; se a flag não existir,
    // significa que é uma nova sessão de navegador e devemos exigir novo login.
    const TAB_FLAG = "app_session_active";
    if (!sessionStorage.getItem(TAB_FLAG)) {
      supabase.auth.signOut().catch(() => {});
    }
    sessionStorage.setItem(TAB_FLAG, "1");

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(async () => {
          await ensureUserSetup(newSession.user);
          await loadRoles(newSession.user.id);
          await loadProfile(newSession.user.id);
        }, 0);
      } else {
        setRoles([]);
        setMustChangePassword(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await ensureUserSetup(session.user);
        await loadRoles(session.user.id);
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const handleFocus = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          loadRoles(session.user.id);
          loadProfile(session.user.id);
        }
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleFocus();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Logout automático por inatividade: reinicia o cronômetro a cada interação
  // do usuário. Sem atividade por INACTIVITY_LIMIT_MS, encerra a sessão.
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout>;

    const doLogout = () => {
      supabase.auth.signOut().catch(() => {});
      toast.warning("Sessão encerrada por inatividade. Faça login novamente.");
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(doLogout, INACTIVITY_LIMIT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  const ensureUserSetup = async (currentUser: User) => {
    const fullName =
      currentUser.user_metadata?.full_name ?? currentUser.user_metadata?.name ?? "";

    await supabase.from("profiles").upsert({
      id: currentUser.id,
      email: currentUser.email ?? null,
      full_name: fullName,
    });

    // Roles are assigned by an administrator; do not auto-grant any role here.
  };

  const loadRoles = async (_userId: string) => {
    const { data, error } = await supabase.rpc("get_my_roles" as never);
    if (!error && Array.isArray(data)) setRoles(data as AppRole[]);
  };

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password" as never)
      .eq("id", userId)
      .maybeSingle();
    setMustChangePassword(Boolean((data as any)?.must_change_password));
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, mustChangePassword, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAccessLogger } from "@/hooks/useAccessLogger";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
// PdfPreviewDialog moved to App.tsx for global availability

const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export default function AppLayout() {
  const { user, loading, roles, mustChangePassword } = useAuth();
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const lang = i18n.resolvedLanguage || "pt";
  useAccessLogger();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (mustChangePassword) return <Navigate to="/trocar-senha" replace />;

  const isInvestidorOnly =
    roles.includes("investidor") &&
    !roles.some((r) => r === "admin" || r === "gestor" || r === "operador");
  const allowedInvestidorPaths = ["/investimentos", "/admin/calculadora"];
  if (isInvestidorOnly && !allowedInvestidorPaths.includes(pathname)) {
    return <Navigate to="/investimentos" replace />;
  }

  const isOperadorOnly =
    roles.includes("operador") &&
    !roles.some((r) => r === "admin" || r === "gestor");
  const allowedOperadorPaths = [
    "/investimentos",
    "/admin/calculadora",
    "/operacoes",
    "/operacoes/debentures",
    "/operacoes/pagamentos",
    "/operacoes/retiradas-pendentes",
    "/operacoes/vencimentos",
    "/operacoes/vendas",
    "/operacoes/antecipacoes",
    "/operacoes/contratos",
    "/operacoes/recompra",
    "/operacoes/informe-rendimento",
    "/operacoes/avaliacoes-risco",
    "/clientes",
    "/clientes/debenturistas",
    "/cedentes",
    "/sacados",
  ];
  const isOperadorPathAllowed =
    allowedOperadorPaths.includes(pathname) ||
    pathname.startsWith("/operacoes/debentures/") ||
    pathname.startsWith("/clientes/debenturistas/");
  if (isOperadorOnly && !isOperadorPathAllowed) {
    return <Navigate to="/investimentos" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-gradient-subtle">
        <AppSidebar />
        <div className="relative z-0 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] font-medium tracking-wide text-muted-foreground tabular-nums">
                {new Date().toLocaleDateString(localeMap[lang] ?? "pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </span>
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <main key={pathname} className="relative z-0 flex-1 p-4 lg:p-6 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

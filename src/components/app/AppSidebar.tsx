import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Users, FileText, LogOut, Landmark, UserCog, TrendingUp, LineChart, Eye, ChevronDown, Contact, Wallet, Settings, Calculator } from "lucide-react";
import logoIcon from "@/assets/logo-jhl-icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";


export function AppSidebar() {
  const { state } = useSidebar();
  const { pathname } = useLocation();
  const { signOut, user, roles } = useAuth();
  const { t } = useTranslation();
  const collapsed = state === "collapsed";

  const operacoesSubItems = [
    { title: t("sidebar.debentures"), url: "/operacoes/debentures" },
    { title: t("sidebar.pagamentos"), url: "/operacoes/pagamentos" },
    { title: t("sidebar.retiradasPendentes"), url: "/operacoes/retiradas-pendentes" },
    { title: t("sidebar.vencimentos"), url: "/operacoes/vencimentos" },
    { title: t("sidebar.vendas"), url: "/operacoes/vendas" },
    { title: t("sidebar.antecipacoes"), url: "/operacoes/antecipacoes" },
    { title: t("sidebar.contratos"), url: "/operacoes/contratos" },
    { title: t("sidebar.recompras"), url: "/operacoes/recompra" },
    { title: t("sidebar.informeRendimento"), url: "/operacoes/informe-rendimento" },
    { title: t("sidebar.avaliacoesRisco"), url: "/operacoes/avaliacoes-risco" },
  ];
  const clientesSubItems = [
    { title: t("sidebar.debenturistas"), url: "/clientes/debenturistas" },
    { title: t("sidebar.sacados"), url: "/sacados" },
    { title: t("sidebar.cedentes"), url: "/cedentes" },
  ];
  const financeiroSubItems = [
    { title: t("sidebar.caixas"), url: "/financeiro/caixas" },
    { title: t("sidebar.movimentacoes"), url: "/financeiro/movimentacoes" },
  ];
  const adminSubItems = [
    { title: t("sidebar.configuracaoBoleto"), url: "/admin/configuracao-boleto" },
    { title: t("sidebar.parametros"), url: "/admin/parametros" },
    { title: t("sidebar.feriados"), url: "/admin/feriados" },
    { title: t("sidebar.taxaCdi"), url: "/admin/taxa-cdi" },
    { title: t("sidebar.cessionaria"), url: "/admin/cessionaria" },
    { title: t("sidebar.fornecedores"), url: "/admin/fornecedores" },
    { title: t("sidebar.despesas"), url: "/admin/despesas" },
    { title: t("sidebar.permissoes"), url: "/admin/permissoes" },
    { title: t("sidebar.logsAcesso"), url: "/admin/logs-acesso" },
    { title: t("sidebar.usuarios"), url: "/usuarios" },
    { title: "Backup", url: "/admin/backup" },
  ];
  const isInvestidorOnly =
    roles.includes("investidor") &&
    !roles.some((r) => r === "admin" || r === "gestor" || r === "operador");
  const isOperadorOnly =
    roles.includes("operador") &&
    !roles.some((r) => r === "admin" || r === "gestor");

  const allItems = [
    { title: t("sidebar.investimentos"), url: "/investimentos", icon: TrendingUp },
    { title: t("sidebar.projecaoCaixa"), url: "/projecao-caixa", icon: LineChart },
    { title: t("sidebar.visaoGeral"), url: "/visao-geral", icon: Eye },
    { title: t("sidebar.calculadora"), url: "/admin/calculadora", icon: Calculator },
  ];
  const items = isOperadorOnly
    ? allItems.filter((i) => i.url === "/investimentos" || i.url === "/admin/calculadora")
    : allItems;

  const operacoesActive = pathname.startsWith("/operacoes");
  const [operacoesOpen, setOperacoesOpen] = useState(operacoesActive);
  const clientesActive = pathname.startsWith("/clientes") || pathname === "/cedentes" || pathname === "/sacados";
  const [clientesOpen, setClientesOpen] = useState(clientesActive);
  const financeiroActive = pathname.startsWith("/financeiro");
  const [financeiroOpen, setFinanceiroOpen] = useState(financeiroActive);
  const adminActive = (pathname.startsWith("/admin") && pathname !== "/admin/calculadora") || pathname === "/usuarios";
  const [adminOpen, setAdminOpen] = useState(adminActive);
  const menuButtonClassName = collapsed ? "mx-auto justify-center" : "";
  const menuLinkClassName = collapsed ? "flex items-center justify-center" : "flex items-center gap-3";



  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 border-b border-sidebar-border px-3 py-0 flex-row items-center justify-center">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center">
            <img src={logoIcon} alt="AUREA" className="h-8 w-auto object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-sidebar-foreground">{t("sidebar.brand")}</span>
              <span className="text-[10px] text-sidebar-foreground/60">{t("sidebar.tagline")}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup className={collapsed ? "p-0" : undefined}>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {isInvestidorOnly ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/investimentos"} className={menuButtonClassName}>
                      <NavLink to="/investimentos" end className={menuLinkClassName}>
                        <TrendingUp className="h-4 w-4" />
                        {!collapsed && <span>{t("sidebar.investimentos")}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/admin/calculadora"} className={menuButtonClassName}>
                      <NavLink to="/admin/calculadora" end className={menuLinkClassName}>
                        <Calculator className="h-4 w-4" />
                        {!collapsed && <span>{t("sidebar.calculadora")}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : (
                <>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={pathname === item.url} className={menuButtonClassName}>
                        <NavLink to={item.url} end className={menuLinkClassName}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                  <Collapsible open={operacoesOpen} onOpenChange={setOperacoesOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={operacoesActive} className={collapsed ? "mx-auto justify-center" : "w-full"}>
                          <FileText className="h-4 w-4" />
                          {!collapsed && (
                            <>
                              <span>{t("sidebar.operacoes")}</span>
                              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${operacoesOpen ? "rotate-180" : ""}`} />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      {!collapsed && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={pathname === "/operacoes"} className="text-xs whitespace-nowrap">
                                <NavLink to="/operacoes" end>{t("sidebar.cadastro")}</NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            {operacoesSubItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.url}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.url} className="text-xs whitespace-nowrap">
                                  <NavLink to={sub.url}>{sub.title}</NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>

                  <Collapsible open={clientesOpen} onOpenChange={setClientesOpen}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={clientesActive} className={collapsed ? "mx-auto justify-center" : "w-full"}>
                          <Contact className="h-4 w-4" />
                          {!collapsed && (
                            <>
                              <span>{t("sidebar.clientes")}</span>
                              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${clientesOpen ? "rotate-180" : ""}`} />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      {!collapsed && (
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {clientesSubItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.url}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.url} className="text-xs whitespace-nowrap">
                                  <NavLink to={sub.url}>{sub.title}</NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>

                  {!isOperadorOnly && (
                    <Collapsible open={financeiroOpen} onOpenChange={setFinanceiroOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={financeiroActive} className={collapsed ? "mx-auto justify-center" : "w-full"}>
                            <Wallet className="h-4 w-4" />
                            {!collapsed && (
                              <>
                                <span>{t("sidebar.financeiro")}</span>
                                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${financeiroOpen ? "rotate-180" : ""}`} />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!collapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {financeiroSubItems.map((sub) => (
                                <SidebarMenuSubItem key={sub.url}>
                                  <SidebarMenuSubButton asChild isActive={pathname === sub.url} className="text-xs whitespace-nowrap">
                                    <NavLink to={sub.url}>{sub.title}</NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )}


                  {roles.includes("admin") && (
                    <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={adminActive} className={collapsed ? "mx-auto justify-center" : "w-full"}>
                            <Settings className="h-4 w-4" />
                            {!collapsed && (
                              <>
                                <span>{t("sidebar.administracao")}</span>
                                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!collapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {adminSubItems.map((sub) => (
                                <SidebarMenuSubItem key={sub.url}>
                                    <SidebarMenuSubButton asChild isActive={pathname === sub.url} className="text-xs whitespace-nowrap">
                                      <NavLink to={sub.url}>{sub.title}</NavLink>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && user && (
          <div className="px-2 pb-1 text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
        )}

        
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className={`w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center px-0" : "justify-start"}`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">{t("common.logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

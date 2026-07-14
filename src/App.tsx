import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import { AuthProvider } from "./hooks/useAuth";
import PdfPreviewDialog from "@/components/PdfPreviewDialog";

const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Auth = lazy(() => import("./pages/Auth"));
const TrocarSenha = lazy(() => import("./pages/TrocarSenha"));
const PainelMigracao = lazy(() => import("./pages/PainelMigracao"));


const Cedentes = lazy(() => import("./pages/cadastros/Cedentes"));
const Sacados = lazy(() => import("./pages/cadastros/Sacados"));
const Operacoes = lazy(() => import("./pages/cadastros/Operacoes"));
const Usuarios = lazy(() => import("./pages/cadastros/Usuarios"));
const Investimentos = lazy(() => import("./pages/Investimentos"));
const ProjecaoCaixa = lazy(() => import("./pages/ProjecaoCaixa"));
const VisaoGeral = lazy(() => import("./pages/VisaoGeral"));
const Debentures = lazy(() => import("./pages/operacoes/Debentures"));
const DebentureDetalhe = lazy(() => import("./pages/operacoes/DebentureDetalhe"));
const Pagamentos = lazy(() => import("./pages/operacoes/Pagamentos"));
const RetiradasPendentes = lazy(() => import("./pages/operacoes/RetiradasPendentes"));
const Vencimentos = lazy(() => import("./pages/operacoes/Vencimentos"));
const Vendas = lazy(() => import("./pages/operacoes/Vendas"));
const Antecipacoes = lazy(() => import("./pages/operacoes/Antecipacoes"));
const Contratos = lazy(() => import("./pages/operacoes/Contratos"));
const Recompra = lazy(() => import("./pages/operacoes/Recompra"));
const InformeRendimento = lazy(() => import("./pages/operacoes/InformeRendimento"));
const AvaliacoesRisco = lazy(() => import("./pages/operacoes/AvaliacoesRisco"));
const Debenturistas = lazy(() => import("./pages/clientes/Debenturistas"));
const DebenturistaForm = lazy(() => import("./pages/clientes/DebenturistaForm"));
const CedentesPF = lazy(() => import("./pages/clientes/CedentesPF"));
const Caixas = lazy(() => import("./pages/financeiro/Caixas"));
const Movimentacoes = lazy(() => import("./pages/financeiro/Movimentacoes"));
const ConfiguracaoBoleto = lazy(() => import("./pages/admin/ConfiguracaoBoleto"));
const Parametros = lazy(() => import("./pages/admin/Parametros"));
const Cessionaria = lazy(() => import("./pages/admin/Cessionaria"));
const Fornecedores = lazy(() => import("./pages/admin/Fornecedores"));
const Despesas = lazy(() => import("./pages/admin/Despesas"));
const Permissoes = lazy(() => import("./pages/admin/Permissoes"));
const Calculadora = lazy(() => import("./pages/admin/Calculadora"));
const Feriados = lazy(() => import("./pages/admin/Feriados"));
const TaxaCDI = lazy(() => import("./pages/admin/TaxaCDI"));
const AuditoriaCDI = lazy(() => import("./pages/admin/AuditoriaCDI"));
const SyncCdiStatus = lazy(() => import("./pages/admin/SyncCdiStatus"));
const LogsAcesso = lazy(() => import("./pages/admin/LogsAcesso"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const Backup = lazy(() => import("./pages/admin/Backup"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex h-full min-h-[40vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PdfPreviewDialog />
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/trocar-senha" element={<TrocarSenha />} />
              <Route path="/painel-migracao" element={<PainelMigracao />} />
              
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/investimentos" replace />} />
                <Route path="/operacoes" element={<Operacoes />} />
                <Route path="/operacoes/debentures" element={<Debentures />} />
                <Route path="/operacoes/debentures/:id" element={<DebentureDetalhe />} />
                <Route path="/operacoes/pagamentos" element={<Pagamentos />} />
                <Route path="/operacoes/retiradas-pendentes" element={<RetiradasPendentes />} />
                <Route path="/operacoes/vencimentos" element={<Vencimentos />} />
                <Route path="/operacoes/vendas" element={<Vendas />} />
                <Route path="/operacoes/antecipacoes" element={<Antecipacoes />} />
                <Route path="/operacoes/contratos" element={<Contratos />} />
                <Route path="/operacoes/recompra" element={<Recompra />} />
                <Route path="/operacoes/informe-rendimento" element={<InformeRendimento />} />
                <Route path="/operacoes/avaliacoes-risco" element={<AvaliacoesRisco />} />
                <Route path="/investimentos" element={<Investimentos />} />
                <Route path="/projecao-caixa" element={<ProjecaoCaixa />} />
                <Route path="/visao-geral" element={<VisaoGeral />} />
                <Route path="/clientes/debenturistas" element={<Debenturistas />} />
                <Route path="/clientes/debenturistas/novo" element={<DebenturistaForm />} />
                <Route path="/clientes/debenturistas/:id" element={<DebenturistaForm />} />
                <Route path="/clientes/cedentes-pf" element={<CedentesPF />} />
                <Route path="/financeiro/caixas" element={<Caixas />} />
                <Route path="/financeiro/movimentacoes" element={<Movimentacoes />} />
                <Route path="/admin/configuracao-boleto" element={<ConfiguracaoBoleto />} />
                <Route path="/admin/parametros" element={<Parametros />} />
                <Route path="/admin/cessionaria" element={<Cessionaria />} />
                <Route path="/admin/fornecedores" element={<Fornecedores />} />
                <Route path="/admin/despesas" element={<Despesas />} />
                <Route path="/admin/permissoes" element={<Permissoes />} />
                <Route path="/admin/calculadora" element={<Calculadora />} />
                <Route path="/admin/feriados" element={<Feriados />} />
                <Route path="/admin/taxa-cdi" element={<TaxaCDI />} />
                <Route path="/admin/auditoria-cdi" element={<AuditoriaCDI />} />
                <Route path="/admin/logs-acesso" element={<LogsAcesso />} />
                <Route path="/admin/configuracoes" element={<Configuracoes />} />
                <Route path="/admin/backup" element={<Backup />} />
                <Route path="/cedentes" element={<Cedentes />} />
                <Route path="/sacados" element={<Sacados />} />
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

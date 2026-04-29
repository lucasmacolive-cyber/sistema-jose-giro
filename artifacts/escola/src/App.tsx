import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import TurmasPage from "@/pages/turmas";
import AlunosPage from "@/pages/alunos";
import ProfessoresPage from "@/pages/professores";
import FuncionariosPage from "@/pages/funcionarios";
import ImpressoesPage from "@/pages/impressoes";
import ImpressoesEnviarPage from "@/pages/impressoes-enviar";
import DocumentosPage from "@/pages/documentos";
import SyncPage from "@/pages/sync";
import AlunoPerfilPage from "@/pages/aluno-perfil";
import ListagensPage from "@/pages/listagens";
import NotasPresencasPage from "@/pages/notas-presencas";
import NotasPresencasAlunoPage from "@/pages/notas-presencas-aluno";
import ArquivoMortoPage from "@/pages/arquivo-morto";
import TransferidosPage from "@/pages/transferidos";
import PontoPage from "@/pages/ponto";
import DiariosPage from "@/pages/diarios";
import DiarioTurmaPage from "@/pages/diario-turma";
import CalendarioPage from "@/pages/calendario";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={DashboardPage} />
      <Route path="/turmas" component={TurmasPage} />
      <Route path="/alunos" component={AlunosPage} />
      <Route path="/alunos/:id" component={AlunoPerfilPage} />
      <Route path="/notas-presencas" component={NotasPresencasPage} />
      <Route path="/notas-presencas/:id" component={NotasPresencasAlunoPage} />
      <Route path="/professores" component={ProfessoresPage} />
      <Route path="/funcionarios" component={FuncionariosPage} />
      <Route path="/impressoes" component={ImpressoesPage} />
      <Route path="/impressao-atividades-giro" component={ImpressoesEnviarPage} />
      <Route path="/documentos" component={DocumentosPage} />
      <Route path="/listagens" component={ListagensPage} />
      <Route path="/sync" component={SyncPage} />
      <Route path="/arquivo-morto" component={ArquivoMortoPage} />
      <Route path="/transferidos" component={TransferidosPage} />
      <Route path="/ponto" component={PontoPage} />
      <Route path="/diarios" component={DiariosPage} />
      <Route path="/diarios/:turma/:ano/:mes" component={DiarioTurmaPage} />
      <Route path="/calendario" component={CalendarioPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

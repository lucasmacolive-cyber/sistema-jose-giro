import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users, BookOpen, UserCircle, Briefcase, KeyRound,
  Search, Plus, Pencil, Trash2, Loader2, X, Save,
  ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Palette,
  RefreshCcw, Check, Settings2, Eye, EyeOff,
  Globe, Copy, ExternalLink, Upload, FileSpreadsheet,
  Zap, ServerCrash, Camera, ImagePlus, Bookmark, ShieldCheck, WifiOff
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ─── Menu ─── */
type SecaoId =
  | "sincronizacao" | "cores" | "alunos"
  | "turmas" | "professores" | "funcionarios" | "usuarios" | "logins" | "diario";

const MENU: { id: SecaoId; label: string; icon: React.ElementType; desc: string; cor: string }[] = [
  { id: "sincronizacao", label: "Sincronização",    icon: RefreshCcw,  desc: "Integração com o SUAP",             cor: "#06b6d4" },
  { id: "cores",         label: "Cores das Turmas", icon: Palette,     desc: "Personalizar cor de cada turma",    cor: "#a855f7" },
  { id: "alunos",        label: "Editar Alunos",    icon: Users,       desc: "Gerenciar cadastro de alunos",      cor: "#3b82f6" },
  { id: "turmas",        label: "Editar Turmas",    icon: BookOpen,    desc: "Gerenciar turmas e responsáveis",   cor: "#8b5cf6" },
  { id: "professores",   label: "Editar Professores",icon: UserCircle, desc: "Gerenciar corpo docente",           cor: "#10b981" },
  { id: "funcionarios",  label: "Editar Funcionários",icon: Briefcase, desc: "Gerenciar equipe administrativa",   cor: "#f59e0b" },
  { id: "usuarios",      label: "Editar Usuários",  icon: KeyRound,    desc: "Gerenciar acessos ao sistema",      cor: "#ef4444" },
  { id: "logins",        label: "Logins Externos",  icon: Globe,       desc: "Logins de sites externos",          cor: "#f97316" },
  { id: "diario",        label: "Config. Diário",   icon: BookOpen,    desc: "Configurações do Diário de Classe", cor: "#10b981" },
];

const TABELA_KEY: Record<string, string> = {
  alunos: "alunos", turmas: "turmas", professores: "professores",
  funcionarios: "funcionarios", usuarios: "usuarios",
};

const COLUNAS_DESTAQUE: Record<string, string[]> = {
  alunos:       ["id","matricula","nome_completo","turma_atual","turno","situacao"],
  turmas:       ["id","nome_turma","turno","professor_responsavel","prof_complementador","prof_educacao_fisica"],
  professores:  ["id","nome","turno","turma_manha","turma_tarde","telefone","vinculo"],
  funcionarios: ["id","matricula","nome_completo","funcao","turno","status","vinculo"],
  usuarios:     ["id","nome_completo","login","senha","perfil"],
};

const LABEL: Record<string, string> = {
  id:"ID", matricula:"Matrícula", nome_completo:"Nome", nome:"Nome",
  turma_atual:"Turma", turno:"Turno", situacao:"Situação",
  nome_turma:"Turma", professor_responsavel:"Prof. Responsável",
  vinculo:"Vínculo", email:"E-mail", funcao:"Função", status:"Status",
  login:"Login", perfil:"Perfil", senha:"Senha", cor:"Cor",
  data_nascimento:"Nascimento", nome_mae:"Mãe", nome_pai:"Pai",
  responsavel:"Responsável", telefone:"Telefone", endereco:"Endereço",
  cpf:"CPF", rg:"RG", sexo:"Sexo", etnia:"Etnia",
  email_pessoal:"E-mail Pessoal", email_responsavel:"E-mail Resp.",
  zona_residencial:"Zona", ano_ingresso:"Ingresso",
  nivel_ensino:"Nível", descricao_curso:"Curso",
  cpf_responsavel:"CPF Resp.", chave_responsavel:"Chave Resp.",
  email_google_classroom:"Google Classroom",
  ano_previsao_conclusao:"Previsão Conclusão", codigo_curso:"Cód. Curso",
  arquivo_morto:"Arq. Morto", motivo_saida:"Motivo Saída", data_saida:"Data Saída",
  turma_manha:"Turma Manhã", turma_tarde:"Turma Tarde",
  identificacao_censo:"Censo", genero:"Gênero",
  telefone_contato:"Telefone", contato_emergencia:"Emergência",
  data_admissao:"Admissão",
  prof_complementador:"Prof. Complementador",
  prof_educacao_fisica:"Prof. Ed. Física",
  auxiliar_turma:"Auxiliar de Turma",
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = (path: string) => `${BASE}/api${path}`;
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(API(path), { credentials: "include", ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).mensagem ?? `Erro ${r.status}`);
  return r.json();
}

/* ══════════════════════════════════════════
   SEÇÃO: Sincronização com SUAP via extensão Chrome
══════════════════════════════════════════ */

type SyncPhase =
  | "idle" | "opening" | "login" | "navigating" | "filling"
  | "results" | "exporting" | "waiting" | "downloading" | "uploading"
  | "done" | "error";

const PHASE_LABELS: Record<SyncPhase, string> = {
  idle: "Aguardando",
  opening: "Abrindo o SUAP...",
  login: "Fazendo login no SUAP...",
  navigating: "Navegando para Listagem de Alunos...",
  filling: "Preenchendo o formulário...",
  results: "Resultados carregados...",
  exporting: "Exportando arquivo XLS...",
  waiting: "Aguardando geração do XLS...",
  downloading: "Baixando arquivo...",
  uploading: "Enviando dados para o sistema...",
  done: "Sincronização concluída!",
  error: "Erro na sincronização",
};

const PHASE_COLORS: Record<SyncPhase, string> = {
  idle: "#64748b", opening: "#06b6d4", login: "#06b6d4",
  navigating: "#3b82f6", filling: "#8b5cf6", results: "#8b5cf6",
  exporting: "#f59e0b", waiting: "#f59e0b", downloading: "#f59e0b",
  uploading: "#10b981", done: "#10b981", error: "#ef4444",
};

const PHASE_PROGRESS: Record<SyncPhase, number> = {
  idle: 0, opening: 8, login: 18, navigating: 30, filling: 45,
  results: 58, exporting: 65, waiting: 72, downloading: 82,
  uploading: 90, done: 100, error: 0,
};


/* ══════════════════════════════════════════
   BLOCO: Upload de PDF de Diário SUAP
══════════════════════════════════════════ */
function BlocoUploadPDF({ apiBase }: { apiBase: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState<any[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [arquivosNome, setArquivosNome] = useState<string[]>([]);
  const [verDetalhes, setVerDetalhes] = useState(false);
  const [drag, setDrag] = useState(false);

  const processarArquivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdfs.length === 0) {
      toast({ title: "Selecione um PDF", description: "Apenas arquivos .pdf são aceitos.", variant: "destructive" });
      return;
    }

    setProcessando(true);
    setResultados(null);
    setErros([]);
    setArquivosNome(pdfs.map(f => f.name));

    const todosResultados: any[] = [];
    const todosErros: string[] = [];

    for (const pdf of pdfs) {
      try {
        const base64 = await fileToBase64(pdf);
        const r = await fetch(`${apiBase}/api/sync/diario-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ arquivo: base64 }),
        });
        const data = await r.json();
        if (!r.ok) {
          todosErros.push(`${pdf.name}: ${data.mensagem ?? "Erro desconhecido"}`);
          if (data.erros) todosErros.push(...data.erros);
        } else {
          todosResultados.push(...(data.secoes ?? []));
          if (data.errosParse?.length) todosErros.push(...data.errosParse.map((e: string) => `${pdf.name}: ${e}`));
        }
      } catch (e: any) {
        todosErros.push(`${pdf.name}: ${e.message}`);
      }
    }

    setProcessando(false);
    setResultados(todosResultados);
    setErros(todosErros);

    const totalAulas = todosResultados.reduce((s: number, r: any) => s + (r.aulasImportadas ?? 0), 0);
    const totalPresencas = todosResultados.reduce((s: number, r: any) => s + (r.presencasImportadas ?? 0), 0);

    if (todosResultados.length > 0) {
      toast({
        title: "Diário(s) importado(s)!",
        description: `${totalAulas} aulas e ${totalPresencas} registros de presença importados.`,
      });
    } else if (todosErros.length > 0) {
      toast({ title: "Erro ao importar", description: todosErros[0], variant: "destructive" });
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    processarArquivos(e.dataTransfer.files);
  };

  const totalAulas = resultados?.reduce((s: number, r: any) => s + (r.aulasImportadas ?? 0), 0) ?? 0;
  const totalPresencas = resultados?.reduce((s: number, r: any) => s + (r.presencasImportadas ?? 0), 0) ?? 0;

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-white/[0.07] p-6">
      <div className="flex items-center gap-2 mb-1">
        <Upload className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-bold text-white">Importar Diário — Upload de PDF</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Baixe o PDF do diário no SUAP (<span className="font-mono text-slate-300">/edu/diario_pdf/ID/0/</span>) e faça o upload aqui. O sistema lê automaticamente as presenças e o conteúdo das aulas.
      </p>

      {/* Área de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200 ${
          drag
            ? "border-violet-400 bg-violet-500/10"
            : "border-white/10 hover:border-violet-400/50 hover:bg-white/[0.02]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={e => processarArquivos(e.target.files)}
        />
        {processando ? (
          <>
            <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
            <span className="text-sm text-violet-300 font-medium">Processando {arquivosNome.join(", ")}...</span>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Arraste o PDF do diário aqui</span>
            <span className="text-xs text-slate-500">ou clique para selecionar · Aceita múltiplos PDFs</span>
          </>
        )}
      </div>

      {/* Resultado */}
      {resultados && resultados.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 text-xs text-emerald-300">
              <span className="font-bold">{totalAulas}</span> aulas e{" "}
              <span className="font-bold">{totalPresencas}</span> registros importados
              {" · "}{resultados.length} turma(s)
            </div>
            <button
              onClick={() => setVerDetalhes(v => !v)}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${verDetalhes ? "rotate-180" : ""}`} />
              {verDetalhes ? "Fechar" : "Detalhes"}
            </button>
          </div>

          {verDetalhes && (
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
              {resultados.map((r: any, i: number) => (
                <div key={i} className="bg-white/5 rounded-xl px-4 py-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-white text-sm">Turma {r.turma}</span>
                    <span className="text-slate-400">{r.turmaCodigo} · {r.bimestre}º Bimestre</span>
                  </div>
                  {r.professorRegente && (
                    <div className="text-slate-400 mb-1">Regente: <span className="text-slate-300">{r.professorRegente}</span></div>
                  )}
                  <div className="flex gap-4 text-slate-300">
                    <span><span className="font-bold text-emerald-400">{r.aulasImportadas}</span> aulas</span>
                    <span><span className="font-bold text-emerald-400">{r.presencasImportadas}</span> presenças</span>
                    {r.alunosNaoEncontrados?.length > 0 && (
                      <span className="text-amber-400">{r.alunosNaoEncontrados.length} não mapeados</span>
                    )}
                  </div>
                  {r.alunosNaoEncontrados?.length > 0 && (
                    <div className="mt-1 text-amber-400/70 text-[0.65rem]">
                      Não encontrados: {r.alunosNaoEncontrados.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Erros de parse */}
      {erros.length > 0 && (
        <div className="mt-3 space-y-1">
          {erros.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{e}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   BLOCO: Sync Automático de Diários (servidor)
══════════════════════════════════════════ */
function BlocoDiariosServidor({ apiBase }: { apiBase: string }) {
  const { toast } = useToast();
  const [rodando,   setRodando]   = useState(false);
  const [pct,       setPct]       = useState(0);
  const [msg,       setMsg]       = useState("");
  const [erro,      setErro]      = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [showDet,   setShowDet]   = useState(false);

  // Polling enquanto rodando
  useEffect(() => {
    if (!rodando) return;
    const iv = setInterval(async () => {
      try {
        const s = await fetch(`${apiBase}/api/sync/baixar-todos-status`, { credentials: "include" }).then(r => r.json());
        setPct(s.pct ?? 0);
        setMsg(s.msg ?? "");
        if (!s.rodando) {
          clearInterval(iv);
          setRodando(false);
          if (s.erro) {
            setErro(s.erro);
            toast({ title: "Erro no sync de diários", description: s.erro, variant: "destructive" });
          } else if (s.concluido) {
            setConcluido(true);
            setResultados(s.resultados ?? []);
            toast({ title: "Diários sincronizados!", description: s.msg });
          }
        }
      } catch (_) {}
    }, 1500);
    return () => clearInterval(iv);
  }, [rodando, apiBase, toast]);

  const iniciar = async () => {
    if (rodando) return;
    setRodando(true);
    setPct(0);
    setMsg("Iniciando sincronização de diários...");
    setErro(null);
    setConcluido(false);
    setResultados([]);
    try {
      const r = await fetch(`${apiBase}/api/sync/baixar-todos-diarios`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!d.ok && !d.mensagem?.includes("andamento")) {
        setRodando(false);
        setErro(d.mensagem || "Falha ao iniciar.");
      }
    } catch (e: any) {
      setRodando(false);
      setErro(e.message || "Erro ao iniciar.");
    }
  };

  const cor = erro ? "#ef4444" : concluido ? "#10b981" : "#8b5cf6";

  return (
    <div
      className="bg-[#0f172a] rounded-2xl border p-5 transition-all duration-500"
      style={{ borderColor: rodando ? `${cor}55` : concluido ? "#10b98155" : erro ? "#ef444455" : "rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${cor}18`, border: `1px solid ${cor}30` }}
        >
          <BookOpen className="h-6 w-6" style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div>
              <h3 className="text-base font-bold text-white">Sync Automático de Diários</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                O servidor faz login no SUAP, baixa o PDF de cada diário e importa presenças e conteúdo.
              </p>
            </div>
            <button
              onClick={iniciar}
              disabled={rodando}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: rodando ? `${cor}18` : `${cor}22`,
                color: rodando ? `${cor}88` : cor,
                border: `1px solid ${cor}40`,
              }}
            >
              {rodando ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando...</>
              ) : (
                <><RefreshCcw className="h-3.5 w-3.5" /> Sincronizar</>
              )}
            </button>
          </div>

          {/* Progresso */}
          {(rodando || concluido) && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: cor }}>
                <span>{msg}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cor}88, ${cor})` }} />
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && !rodando && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Resultados */}
          {concluido && resultados.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowDet(v => !v)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                {showDet ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {showDet ? "Ocultar detalhes" : `Ver detalhes (${resultados.length} turmas)`}
              </button>
              {showDet && (
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1 pr-1">
                  {resultados.map((r: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${r.erros?.length ? "bg-yellow-500/8 text-yellow-300" : "bg-emerald-500/8 text-emerald-300"}`}>
                      {r.erros?.length
                        ? <AlertTriangle className="h-3 w-3 shrink-0" />
                        : <Check className="h-3 w-3 shrink-0" />}
                      <span className="font-bold">{r.turma}</span>
                      <span className="text-slate-400">{r.aulasImportadas} aulas · {r.presencasImportadas} presenças</span>
                      {r.alunosNaoEncontrados?.length > 0 && (
                        <span className="text-slate-500">· {r.alunosNaoEncontrados.length} não encontrados</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   BLOCO: Sincronização de Diários via Extensão
══════════════════════════════════════════ */
type DiarioSyncPhase =
  | "idle" | "diarios-opening" | "diarios-login" | "diarios-listing"
  | "diarios-processing" | "diarios-done" | "error";

function BlocoDiariosSinc({ extensaoInstalada, apiBase }: { extensaoInstalada: boolean | null; apiBase: string }) {
  const { toast } = useToast();
  const [phase, setPhase]         = useState<DiarioSyncPhase>("idle");
  const [msg, setMsg]             = useState("");
  const [progAtual, setProgAtual] = useState(0);
  const [progTotal, setProgTotal] = useState(0);
  const [resultados, setResultados] = useState<any[]>([]);
  const [showResultados, setShowResultados] = useState(false);
  const [modo, setModo]           = useState<"manual" | "auto">("manual");
  const [linksTexto, setLinksTexto] = useState("");
  const [linksSalvos, setLinksSalvos] = useState<string[]>([]);
  const [salvando, setSalvando]   = useState(false);
  const [linksSujos, setLinksSujos] = useState(false);
  const [autoContagem, setAutoContagem] = useState<number | null>(null); // countdown em segundos
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Metadata dos links (turma identificada, última sync)
  type LinkMeta = { link: string; turma: string | null; ultimaSync: string | null; status: string | null };
  const [linksMeta, setLinksMeta] = useState<LinkMeta[]>([]);
  const [linksBaixando, setLinksBaixando] = useState<Record<string, { phase: "baixando"|"done"|"error"; msg: string }>>({});
  const [identificando, setIdentificando] = useState(false);

  const carregarLinksMeta = useCallback(() => {
    fetch(`${apiBase}/api/sync/diario-links-meta`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.links) setLinksMeta(d.links); })
      .catch(() => {});
  }, [apiBase]);

  // Carregar links salvos ao montar
  useEffect(() => {
    fetch(`${apiBase}/api/sync/diario-links`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.links?.length) {
          setLinksSalvos(data.links);
          setLinksTexto(data.links.join("\n"));
        }
      })
      .catch(() => {});
    carregarLinksMeta();
  }, [apiBase, carregarLinksMeta]);

  // Auto-sync ao entrar como master (uma vez por dia)
  useEffect(() => {
    if (extensaoInstalada !== true || linksSalvos.length === 0) return;

    // Verificar se é o usuário master
    fetch(`${apiBase}/api/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(user => {
        if (user?.perfil !== "master") return;

        // Verificar se já sincronizou hoje
        const KEY = "diario_ultima_auto_sync";
        const ultima = localStorage.getItem(KEY);
        const agora = Date.now();
        const OITO_HORAS = 8 * 60 * 60 * 1000;
        if (ultima && agora - Number(ultima) < OITO_HORAS) return;

        // Mostrar contagem regressiva de 5s antes de disparar
        let restam = 5;
        setAutoContagem(restam);
        const tick = setInterval(() => {
          restam -= 1;
          if (restam <= 0) {
            clearInterval(tick);
            setAutoContagem(null);
            localStorage.setItem(KEY, String(Date.now()));
            // Disparar sync com os links salvos
            window.dispatchEvent(new CustomEvent("suap-sync-diarios-start", {
              detail: { apiBase, linksManual: linksSalvos }
            }));
            setPhase("diarios-opening");
            setMsg("Sincronização automática iniciada...");
            setResultados([]);
            setShowResultados(false);
          } else {
            setAutoContagem(restam);
          }
        }, 1000);
        autoTimerRef.current = tick as unknown as ReturnType<typeof setTimeout>;
      })
      .catch(() => {});

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [extensaoInstalada, linksSalvos, apiBase]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const p = detail.phase as string;
      if (!p.startsWith("diarios") && p !== "error") return;

      setPhase(p as DiarioSyncPhase);
      setMsg(detail.msg || "");
      if (detail.atual) setProgAtual(detail.atual);
      if (detail.total) setProgTotal(detail.total);
      if (p === "diarios-done") {
        if (detail.resultados) setResultados(detail.resultados);
        setShowResultados(true);
        toast({ title: "Diários importados!", description: detail.msg });
        setTimeout(() => setPhase("idle"), 6000);
      } else if (p === "error") {
        toast({ title: "Erro nos diários", description: detail.msg, variant: "destructive" });
        setTimeout(() => setPhase("idle"), 5000);
      }
    };
    window.addEventListener("suap-sync-update", handler);
    return () => window.removeEventListener("suap-sync-update", handler);
  }, [toast]);

  const parsearLinks = () =>
    linksTexto.split("\n").map(l => l.trim()).filter(l => l.includes("suap") && l.includes("diario"));

  const salvarLinks = async () => {
    const links = parsearLinks();
    if (links.length === 0) {
      toast({ title: "Nenhum link válido para salvar", variant: "destructive" });
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch(`${apiBase}/api/sync/diario-links`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      if (!r.ok) throw new Error();
      setLinksSalvos(links);
      setLinksSujos(false);
      toast({ title: `${links.length} links salvos!`, description: "A sincronização automática vai usar esses diários." });
      carregarLinksMeta();
    } catch {
      toast({ title: "Erro ao salvar links", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const baixarLink = async (link: string) => {
    setLinksBaixando(prev => ({ ...prev, [link]: { phase: "baixando", msg: "" } }));
    try {
      const r = await fetch(`${apiBase}/api/sync/baixar-diario`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setLinksBaixando(prev => ({ ...prev, [link]: { phase: "error", msg: data.mensagem || "Erro ao baixar" } }));
        toast({ title: "Erro ao baixar diário", description: data.mensagem, variant: "destructive" });
        return;
      }
      setLinksBaixando(prev => ({
        ...prev,
        [link]: { phase: "done", msg: `${data.turma} · ${data.totalAulas} aulas · ${data.totalPresencas} presenças` },
      }));
      carregarLinksMeta();
    } catch (e: any) {
      const msg = e.message || "Erro de conexão";
      setLinksBaixando(prev => ({ ...prev, [link]: { phase: "error", msg } }));
      toast({ title: "Erro de conexão", description: msg, variant: "destructive" });
    }
  };

  const identificarLinks = async () => {
    setIdentificando(true);
    try {
      const r = await fetch(`${apiBase}/api/sync/identificar-links`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (data.ok) {
        carregarLinksMeta();
        toast({ title: `${data.identificados.length} turma(s) identificada(s)!`, description: "As turmas foram mapeadas automaticamente." });
      } else {
        toast({ title: "Erro ao identificar", description: data.mensagem, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setIdentificando(false);
    }
  };

  const iniciarSyncDiarios = () => {
    if (!extensaoInstalada || phase !== "idle") return;
    const linksManual = modo === "manual" ? parsearLinks() : [];
    if (modo === "manual" && linksManual.length === 0) {
      toast({ title: "Nenhum link válido", description: "Cole os links das páginas dos diários (um por linha).", variant: "destructive" });
      return;
    }
    window.dispatchEvent(new CustomEvent("suap-sync-diarios-start", { detail: { apiBase, linksManual } }));
    setPhase("diarios-opening");
    setMsg("Iniciando sincronização dos diários...");
    setResultados([]);
    setShowResultados(false);
  };

  const ativo = !["idle", "diarios-done", "error"].includes(phase);
  const pct = phase === "idle" ? 0
    : phase === "diarios-opening" ? 5
    : phase === "diarios-login" ? 15
    : phase === "diarios-listing" ? 25
    : phase === "diarios-processing" && progTotal > 0 ? 25 + Math.round((progAtual / progTotal) * 70)
    : phase === "diarios-done" ? 100
    : 0;

  const cor = phase === "error" ? "#ef4444" : phase === "diarios-done" ? "#10b981" : "#8b5cf6";

  const naoInstalada = extensaoInstalada === false;

  const qtdLinksValidos = linksTexto.split("\n").filter(l => l.trim().includes("suap") && l.trim().includes("diario")).length;

  return (
    <div
      className="bg-[#0f172a] rounded-2xl border p-6 transition-all duration-500"
      style={{ borderColor: ativo ? `${cor}55` : "rgba(255,255,255,0.07)" }}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Sincronizar Diários de Classe</h3>
            <span className="text-[0.6rem] font-black uppercase tracking-widest bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">v3.1</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Importa as presenças de cada diário do SUAP. Cole os links das páginas ou use o modo automático.
          </p>
        </div>
        <button
          onClick={iniciarSyncDiarios}
          disabled={ativo || naoInstalada}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
            naoInstalada
              ? "bg-white/5 text-slate-500 cursor-not-allowed"
              : ativo
              ? "bg-violet-500/20 text-violet-300 cursor-wait"
              : "bg-violet-600 hover:bg-violet-500 text-white"
          }`}
        >
          {ativo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          {ativo ? "Importando..." : "Importar Diários"}
        </button>
      </div>

      {/* Toggle modo */}
      {!ativo && (
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4 w-fit">
          {(["manual", "auto"] as const).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                modo === m
                  ? "bg-violet-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {m === "manual" ? "Links manuais" : "Automático"}
            </button>
          ))}
        </div>
      )}

      {/* Contagem regressiva do auto-sync */}
      {autoContagem !== null && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
            <span className="text-sm text-violet-300 font-medium">
              Sincronização automática em <span className="font-black text-white">{autoContagem}s</span>...
            </span>
          </div>
          <button
            onClick={() => {
              if (autoTimerRef.current) clearInterval(autoTimerRef.current);
              setAutoContagem(null);
            }}
            className="text-[0.7rem] font-bold text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Modo manual: textarea de links */}
      {modo === "manual" && !ativo && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[0.7rem] font-bold uppercase tracking-widest text-slate-400">
              Links dos diários (um por linha)
            </label>
            <div className="flex items-center gap-2">
              {linksSalvos.length > 0 && !linksSujos && (
                <span className="flex items-center gap-1 text-[0.65rem] text-emerald-400 font-bold">
                  <Check className="h-3 w-3" /> {linksSalvos.length} salvos · sync automático ativo
                </span>
              )}
              <button
                onClick={salvarLinks}
                disabled={salvando || qtdLinksValidos === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.7rem] font-bold transition-all ${
                  salvando || qtdLinksValidos === 0
                    ? "bg-white/5 text-slate-500 cursor-not-allowed"
                    : linksSujos
                    ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                    : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                }`}
              >
                {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {salvando ? "Salvando..." : linksSujos ? "Salvar alterações" : "Salvar links"}
              </button>
            </div>
          </div>
          <textarea
            value={linksTexto}
            onChange={e => { setLinksTexto(e.target.value); setLinksSujos(true); }}
            rows={6}
            placeholder={`https://suap.campos.rj.gov.br/edu/diario/56202/\nhttps://suap.campos.rj.gov.br/edu/diario/56255/\n...`}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 resize-none font-mono focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <p className="mt-1.5 text-[0.65rem] text-slate-500">
            {qtdLinksValidos > 0
              ? <span className="text-violet-400 font-bold">{qtdLinksValidos} link{qtdLinksValidos > 1 ? "s" : ""} válido{qtdLinksValidos > 1 ? "s" : ""} · salve para ativar o sync automático diário</span>
              : "Cole os links das páginas dos diários copiados da barra de endereço do SUAP"
            }
          </p>
        </div>
      )}

      {/* ── Lista de diários com botão individual por link ── */}
      {linksMeta.length > 0 && !ativo && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-slate-400">
              Diários cadastrados ({linksMeta.length})
            </span>
            <button
              onClick={identificarLinks}
              disabled={identificando}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.68rem] font-bold bg-slate-700/60 text-slate-300 hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              {identificando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              {identificando ? "Identificando..." : "Identificar turmas"}
            </button>
          </div>
          <div className="space-y-1.5">
            {linksMeta.map(({ link, turma, ultimaSync }) => {
              const estado = linksBaixando[link];
              const fase = estado?.phase ?? "idle";
              const suapId = link.match(/\/edu\/diario\/(\d+)\//)?.[1] ?? "?";
              return (
                <div key={link} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/30 border border-white/6">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {turma ?? <span className="text-slate-400">Diário #{suapId}</span>}
                    </p>
                    {ultimaSync && (
                      <p className="text-[0.6rem] text-slate-500 mt-0.5">
                        Atualizado: {new Date(ultimaSync).toLocaleDateString("pt-BR")} {new Date(ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {!turma && (
                      <p className="text-[0.6rem] text-slate-600 mt-0.5 font-mono truncate">
                        {link.replace("https://suap.campos.rj.gov.br", "").substring(0, 40)}
                      </p>
                    )}
                    {fase === "error" && <p className="text-[0.6rem] text-red-400 mt-0.5">{estado?.msg}</p>}
                    {fase === "done"  && <p className="text-[0.6rem] text-emerald-400 mt-0.5">{estado?.msg}</p>}
                  </div>
                  {/* 3-state button */}
                  <button
                    onClick={() => { if (fase !== "baixando") baixarLink(link); }}
                    disabled={fase === "baixando"}
                    className={`flex-shrink-0 relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.68rem] font-black transition-all overflow-hidden border ${
                      fase === "baixando"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/40 cursor-wait"
                        : fase === "done"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer"
                        : "bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25 cursor-pointer"
                    }`}
                  >
                    {fase === "baixando" && (
                      <span className="absolute inset-0 overflow-hidden rounded-lg">
                        <span className="absolute inset-y-0 left-0 bg-amber-400/20 animate-[growing_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
                      </span>
                    )}
                    <span className="relative flex items-center gap-1">
                      {fase === "baixando" ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Baixando...</>
                      ) : fase === "done" ? (
                        <><Check className="h-3 w-3" /> Sincronizar</>
                      ) : (
                        <><RefreshCcw className="h-3 w-3" /> Atualizar</>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modo automático: info */}
      {modo === "auto" && !ativo && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-300/80">
          <p className="font-bold text-amber-300 mb-1">Modo automático</p>
          A extensão vai navegar pela lista de diários do SUAP, clicar em cada um e aguardar a geração de cada PDF.
          Pode demorar 3–5 min por diário. Prefira o modo "Links manuais" para mais controle.
        </div>
      )}

      {naoInstalada && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Extensão Chrome não detectada. Instale a extensão v3.1.0 primeiro (disponível em Ajustes → Sincronização acima).
        </div>
      )}

      {/* Barra de progresso */}
      {ativo && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span className="truncate pr-2">{msg}</span>
            {progTotal > 0 && <span className="shrink-0">{progAtual}/{progTotal}</span>}
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: cor }}
            />
          </div>
        </div>
      )}

      {/* Mensagem de conclusão */}
      {phase === "diarios-done" && !ativo && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm mb-4">
          <Check className="h-4 w-4 shrink-0" />
          {msg}
        </div>
      )}

      {/* Resultados detalhados */}
      {resultados.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowResultados(v => !v)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            {showResultados ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showResultados ? "Ocultar detalhes" : `Ver detalhes (${resultados.length} diários)`}
          </button>
          {showResultados && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1 pr-1">
              {resultados.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${r.ok ? "bg-emerald-500/8 text-emerald-300" : "bg-red-500/8 text-red-300"}`}>
                  {r.ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                  <span className="font-bold">{r.turma || r.turmaNome || r.id}</span>
                  {r.ok
                    ? <span className="text-slate-400">{r.aulasExtraidas} aulas · {r.presencasInseridas} presenças</span>
                    : <span className="text-red-400/70">{r.erro}</span>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SecaoSincronizacao() {
  const { toast } = useToast();
  const [extensaoInstalada, setExtensaoInstalada] = useState<boolean | null>(null);
  const [downloadTs, setDownloadTs] = useState(() => Date.now());
  const [uploadManual, setUploadManual] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadDetalhes, setUploadDetalhes] = useState<{ adicionados: number; atualizados: number; transferidos: number; marcadosSaida: number; erros: number; total: number } | null>(null);
  const [substituirTudo, setSubstituirTudo] = useState(false);
  const [uploadProf, setUploadProf] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [uploadProfMsg, setUploadProfMsg] = useState("");
  const [uploadProfDetalhes, setUploadProfDetalhes] = useState<{ adicionados: number; atualizados: number; ignorados: number; total: number } | null>(null);
  const [dragOverProf, setDragOverProf] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Sync via extensão Chrome
  const [syncPhase, setSyncPhase] = useState<SyncPhase>("idle");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncTotal, setSyncTotal] = useState<number | null>(null);

  // Sync automático (server-side) — dados de alunos
  const [autoRodando, setAutoRodando] = useState(false);
  const [autoPct, setAutoPct] = useState(0);
  const [autoMsg, setAutoMsg] = useState("");
  const [autoErro, setAutoErro] = useState<string | null>(null);
  const [autoConcluido, setAutoConcluido] = useState(false);

  // Modo completo: encadeia sync de dados + sync de diários
  const [modoCompleto, setModoCompleto] = useState(false);
  const [diariosRodando, setDiariosRodando] = useState(false);
  const [diariosPct, setDiariosPct] = useState(0);
  const [diariosMsg, setDiariosMsg] = useState("");
  const [diariosErro, setDiariosErro] = useState<string | null>(null);
  const [diariosConcluido, setDiariosConcluido] = useState(false);

  const [historico, setHistorico] = useState<{
    status: string; ultimaSync?: string; mensagem?: string; totalAlunos?: number;
  } | null>(null);

  // Credenciais SUAP (para auto-sync servidor)
  const [credUsuario, setCredUsuario]     = useState("");
  const [credSenha, setCredSenha]         = useState("");
  const [credTemSenha, setCredTemSenha]   = useState(false);
  const [credSalvando, setCredSalvando]   = useState(false);
  const [credSalvo, setCredSalvo]         = useState(false);
  const [mostrarSenha, setMostrarSenha]   = useState(false);

  // Bookmarklet
  const [bookmarkToken, setBookmarkToken]     = useState<string | null>(null);
  const [bookmarkHref, setBookmarkHref]       = useState<string>("");
  const [bookmarkStatus, setBookmarkStatus]   = useState<"idle"|"gerando"|"pronto"|"erro">("idle");
  const [bookmarkCopiado, setBookmarkCopiado] = useState(false);
  const bookmarkLinkRef = useRef<HTMLAnchorElement>(null);
  // Definir href via DOM para bypass da validação do React (que bloqueia javascript: URLs)
  useEffect(() => {
    if (bookmarkLinkRef.current && bookmarkHref) {
      bookmarkLinkRef.current.setAttribute("href", bookmarkHref);
    }
  }, [bookmarkHref]);

  // Detectar extensão e carregar histórico + credenciais
  useEffect(() => {
    setExtensaoInstalada(document.documentElement.hasAttribute("data-suap-sync"));
    apiFetch("/sync/status").then(setHistorico).catch(() => {});
    apiFetch("/sync/credenciais").then((d) => {
      if (d.usuario) setCredUsuario(d.usuario);
      setCredTemSenha(!!d.temSenha);
    }).catch(() => {});
  }, []);

  // Polling do sync automático (dados de alunos)
  useEffect(() => {
    if (!autoRodando) return;
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch("/sync/auto/status");
        setAutoPct(s.pct ?? 0);
        setAutoMsg(s.msg ?? "");
        if (!s.rodando) {
          setAutoRodando(false);
          clearInterval(interval);
          if (s.erro) {
            setAutoErro(s.erro);
            setModoCompleto(false);
            toast({ title: "Erro na sincronização", description: s.erro, variant: "destructive" });
          } else if (s.concluido) {
            setAutoConcluido(true);
            toast({ title: "Dados sincronizados!", description: s.msg });
            apiFetch("/sync/status").then(setHistorico).catch(() => {});
          }
        }
      } catch (e) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [autoRodando, toast]);

  // Encadear sync de diários após dados concluídos (modo completo)
  useEffect(() => {
    if (autoConcluido && modoCompleto && !diariosRodando && !diariosConcluido && !diariosErro) {
      iniciarSyncDiarios();
    }
  }, [autoConcluido, modoCompleto]);

  // Polling do sync de diários (modo completo)
  useEffect(() => {
    if (!diariosRodando) return;
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch("/sync/diarios-auto/status");
        setDiariosPct(s.pct ?? 0);
        setDiariosMsg(s.msg ?? "");
        if (!s.rodando) {
          setDiariosRodando(false);
          clearInterval(interval);
          setModoCompleto(false);
          if (s.erro) {
            setDiariosErro(s.erro);
            toast({ title: "Erro nos diários", description: s.erro, variant: "destructive" });
          } else if (s.concluido) {
            setDiariosConcluido(true);
            toast({ title: "Sincronização completa!", description: "Dados e diários sincronizados com sucesso." });
          }
        }
      } catch (e) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [diariosRodando, toast]);

  async function iniciarSyncDiarios() {
    setDiariosRodando(true);
    setDiariosPct(0);
    setDiariosMsg("Iniciando sincronização de diários...");
    setDiariosErro(null);
    setDiariosConcluido(false);
    try {
      const r = await apiFetch("/sync/diarios-auto", { method: "POST" });
      if (!r.ok && !r.mensagem?.includes("andamento")) {
        setDiariosRodando(false);
        setDiariosErro(r.mensagem || "Falha ao iniciar sync de diários.");
        setModoCompleto(false);
      }
    } catch (e: any) {
      setDiariosRodando(false);
      setDiariosErro(e.message || "Erro ao iniciar sync de diários.");
      setModoCompleto(false);
    }
  }

  // Ouvir atualizações da extensão Chrome
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const phase = detail.phase as SyncPhase;
      setSyncPhase(phase);
      setSyncMsg(detail.msg || "");
      if (detail.total) setSyncTotal(detail.total);
      if (phase === "done") {
        toast({ title: "Sincronização concluída!", description: detail.msg });
        apiFetch("/sync/status").then(setHistorico).catch(() => {});
        setTimeout(() => setSyncPhase("idle"), 4000);
      } else if (phase === "error") {
        toast({ title: "Erro na sincronização", description: detail.msg, variant: "destructive" });
        setTimeout(() => setSyncPhase("idle"), 5000);
      }
    };
    window.addEventListener("suap-sync-update", handler);
    return () => window.removeEventListener("suap-sync-update", handler);
  }, [toast]);

  const iniciarSyncExtensao = () => {
    if (!extensaoInstalada || syncPhase !== "idle") return;
    const apiBase = window.location.origin + BASE;
    window.dispatchEvent(new CustomEvent("suap-sync-start", { detail: { apiBase } }));
    setSyncPhase("opening");
    setSyncMsg("Iniciando...");
  };

  const iniciarSyncAuto = async () => {
    if (autoRodando) return;
    setAutoRodando(true);
    setAutoPct(0);
    setAutoMsg("Iniciando sincronização automática...");
    setAutoErro(null);
    setAutoConcluido(false);
    try {
      const resp = await apiFetch("/sync/auto", { method: "POST" });
      if (!resp.ok) {
        setAutoRodando(false);
        setAutoErro(resp.mensagem || "Falha ao iniciar.");
      }
    } catch (e: any) {
      setAutoRodando(false);
      setAutoErro(e.message || "Erro ao iniciar sincronização.");
    }
  };

  const formatarData = (iso?: string) => {
    if (!iso) return "Nenhuma sincronização realizada";
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const processarArquivoXLS = async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xls" && ext !== "xlsx") {
      setUploadManual("error");
      setUploadMsg("Formato inválido. Use o arquivo .xls ou .xlsx exportado do SUAP.");
      return;
    }
    setUploadManual("loading");
    setUploadMsg("Processando arquivo...");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const resp = await apiFetch("/sync/upload-alunos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arquivo: base64, substituirTudo }),
        });
        setUploadDetalhes({
          adicionados: resp.adicionados ?? 0,
          atualizados: resp.atualizados ?? 0,
          transferidos: resp.transferidos ?? 0,
          marcadosSaida: resp.marcadosSaida ?? 0,
          erros: resp.erros ?? 0,
          total: resp.total ?? 0,
        });
        setUploadManual("ok");
        setUploadMsg("Planilha importada com sucesso!");
        apiFetch("/sync/status").then(setHistorico).catch(() => {});
      } catch (e: any) {
        setUploadManual("error");
        setUploadMsg(e.message || "Erro ao processar o arquivo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const processarArquivoProfessores = async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xls" && ext !== "xlsx") {
      setUploadProf("error");
      setUploadProfMsg("Formato inválido. Use o arquivo .xls ou .xlsx exportado do SUAP.");
      return;
    }
    setUploadProf("loading");
    setUploadProfMsg("Processando arquivo...");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const resp = await apiFetch("/sync/upload-professores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arquivo: base64 }),
        });
        setUploadProfDetalhes({
          adicionados: resp.adicionados ?? 0,
          atualizados: resp.atualizados ?? 0,
          ignorados: resp.ignorados ?? 0,
          total: resp.total ?? 0,
        });
        setUploadProf("ok");
        setUploadProfMsg("Professores importados com sucesso!");
      } catch (e: any) {
        setUploadProf("error");
        setUploadProfMsg(e.message || "Erro ao processar o arquivo.");
      }
    };
    reader.readAsDataURL(file);
  };

  const salvarCredenciais = async () => {
    if (!credUsuario.trim()) {
      toast({ title: "Usuário obrigatório", description: "Informe o login do SUAP.", variant: "destructive" });
      return;
    }
    setCredSalvando(true);
    try {
      await apiFetch("/sync/credenciais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: credUsuario.trim(), senha: credSenha || undefined }),
      });
      setCredSalvo(true);
      if (credSenha) setCredTemSenha(true);
      setCredSenha("");
      toast({ title: "Credenciais salvas!", description: "O SUAP será sincronizado automaticamente." });
      setTimeout(() => setCredSalvo(false), 4000);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setCredSalvando(false);
    }
  };

  const extCor    = PHASE_COLORS[syncPhase];
  const extPct    = PHASE_PROGRESS[syncPhase];
  const extAtivo  = !["idle", "done", "error"].includes(syncPhase);

  const autoCor   = autoErro ? "#ef4444" : autoConcluido ? "#10b981" : "#06b6d4";

  /* ── Gerar Bookmarklet ── */
  async function gerarBookmarklet() {
    setBookmarkStatus("gerando");
    try {
      const resp = await apiFetch("/sync/gerar-token", { method: "POST" });
      const token: string = resp.token;
      const apiUrl = `${window.location.origin}${BASE}/api/sync/bookmarklet-upload`;

      // Código JavaScript do bookmarklet INTELIGENTE — tenta servidor primeiro, depois browser no SUAP
      const code = `(async function(){
if(document.getElementById('_sjov'))return;
var API='${apiUrl}';var TK='${token}';
var d=document.createElement('div');
d.id='_sjov';
d.style.cssText='position:fixed;top:16px;right:16px;background:#0f172a;color:#fff;padding:18px 22px;border-radius:14px;z-index:2147483647;font-size:13px;font-family:Arial,sans-serif;max-width:360px;border:2px solid #3b82f6;box-shadow:0 8px 32px rgba(0,0,0,0.7);line-height:1.7;';
d.innerHTML='<b style="font-size:14px;display:block;margin-bottom:6px;">🏫 Sistema Escolar — Sincronização</b><span id="_sjm">Iniciando...</span>';
document.body.appendChild(d);
function msg(t,c){var el=document.getElementById('_sjm');if(el)el.innerHTML=t;if(c)d.style.borderColor=c;}
function fim(ms){setTimeout(function(){var el=document.getElementById('_sjov');if(el)el.remove();},ms||10000);}

var onSuap=location.host.includes('suap');

if(onSuap){
  await modoBrowser();
}else{
  var ok=await modoServidor();
  if(!ok){
    msg('Servidor indisponível — abrindo SUAP em nova aba...<br><small style="opacity:.7">Clique no favorito novamente no SUAP para sincronizar.</small>','#f59e0b');
    setTimeout(function(){window.open('https://suap.campos.rj.gov.br/edu/relatorio/','_blank');},1200);
    fim(18000);
  }
}

async function modoServidor(){
  try{
    msg('Tentando sincronização via servidor...');
    var r=await fetch(API.replace('/sync/bookmarklet-upload','/sync/auto'),{method:'POST',credentials:'include'});
    if(!r.ok)return false;
    for(var i=0;i<25;i++){
      await new Promise(function(r){setTimeout(r,1200);});
      var s=await fetch(API.replace('/sync/bookmarklet-upload','/sync/auto/status'),{credentials:'include'});
      var data=await s.json();
      msg('Sincronizando via servidor... <b>'+data.pct+'%</b>');
      if(!data.rodando){
        if(data.erro)return false;
        if(data.concluido){msg('✅ '+( data.msg||'Sincronização concluída via servidor!'),'#10b981');fim(8000);return true;}
      }
    }
    return false;
  }catch(e){return false;}
}

async function modoBrowser(){
  try{
    msg('Modo SUAP: carregando formulário de alunos...');
    var r1=await fetch('/edu/relatorio/',{credentials:'include'});
    var h1=await r1.text();
    var p=new DOMParser();var doc=p.parseFromString(h1,'text/html');
    var csrfEl=doc.querySelector('[name="csrfmiddlewaretoken"]');
    var csrf=csrfEl?csrfEl.value:'';
    if(!csrf){msg('❌ CSRF do SUAP não encontrado. Faça login no SUAP primeiro.','#ef4444');fim();return;}
    var exibicoes=Array.prototype.slice.call(doc.querySelectorAll('[name="exibicao"]')).map(function(el){return el.value;});
    msg('Preenchendo formulário ('+exibicoes.length+' campos)...');
    var params=new URLSearchParams();
    params.append('csrfmiddlewaretoken',csrf);params.append('uo','205');
    params.append('ano_letivo','9');params.append('relatorio_form','Pesquisar');
    exibicoes.forEach(function(e){params.append('exibicao',e);});
    var r2=await fetch('/edu/relatorio/',{method:'POST',credentials:'include',
      headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRFToken':csrf},
      body:params.toString()});
    var h2=await r2.text();
    msg('Buscando link de exportação XLS...');
    var doc2=p.parseFromString(h2,'text/html');
    var links=Array.prototype.slice.call(doc2.querySelectorAll('a[href]'));
    var expLink=links.find(function(a){var h=(a.getAttribute('href')||'').toLowerCase();return(h.includes('export')&&h.includes('xls'))||h.includes('formato=xls')||h.includes('gerar_arquivo');});
    var expUrl=expLink?(new URL(expLink.getAttribute('href'),location.origin)).href:location.origin+'/edu/relatorio/?formato=xls';
    msg('Exportando arquivo XLS...');
    var r3=await fetch(expUrl,{credentials:'include',headers:{'Accept':'application/vnd.ms-excel,application/octet-stream,*/*'}});
    var ct=r3.headers.get('content-type')||'';
    var buf;
    if(ct.includes('spreadsheet')||ct.includes('excel')||ct.includes('octet-stream')){buf=await r3.arrayBuffer();}
    else{
      var taskUrl=r3.headers.get('location')||expUrl;
      for(var i=0;i<30;i++){
        await new Promise(function(r){setTimeout(r,2000);});
        msg('Aguardando geração do XLS... ('+(i+1)+'/30)');
        var rp=await fetch(taskUrl,{credentials:'include'});
        var pt=rp.headers.get('content-type')||'';
        if(pt.includes('spreadsheet')||pt.includes('excel')||pt.includes('octet-stream')){buf=await rp.arrayBuffer();break;}
        var ph=await rp.text();
        var linkDl=p.parseFromString(ph,'text/html').querySelector('a[href*=".xls"]');
        if(linkDl){var rr=await fetch((new URL(linkDl.getAttribute('href'),location.origin)).href,{credentials:'include'});buf=await rr.arrayBuffer();break;}
      }
    }
    if(!buf){msg('❌ Não foi possível obter o XLS do SUAP.','#ef4444');fim();return;}
    msg('Enviando para o Sistema Escolar...');
    var bytes=new Uint8Array(buf);
    var bin='';for(var i=0;i<bytes.byteLength;i++)bin+=String.fromCharCode(bytes[i]);
    var b64=btoa(bin);
    var ar=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({arquivo:b64,token:TK})});
    var res=await ar.json();
    if(ar.ok){msg('✅ '+(res.mensagem||'Sincronização concluída!'),'#10b981');}
    else{msg('❌ '+(res.mensagem||'Erro na sincronização.'),'#ef4444');}
  }catch(e){msg('❌ Erro: '+e.message,'#ef4444');}
  fim();
}
})();`;

      const href = "javascript:" + encodeURIComponent(code);
      setBookmarkHref(href);
      setBookmarkToken(token);
      setBookmarkStatus("pronto");
    } catch (e: any) {
      setBookmarkStatus("erro");
      toast({ title: "Erro ao gerar bookmarklet", description: e.message, variant: "destructive" });
    }
  }

  async function copiarBookmarklet() {
    if (!bookmarkHref) return;
    try {
      await navigator.clipboard.writeText(bookmarkHref);
      setBookmarkCopiado(true);
      setTimeout(() => setBookmarkCopiado(false), 3000);
    } catch {}
  }

  return (
    <div className="space-y-5">

      {/* ═══════════════════════════════════════════
          BLOCO 1 — Sincronização Automática (servidor)
      ═══════════════════════════════════════════ */}
      <div
        className="bg-[#0f172a] rounded-2xl border p-6 transition-all duration-500"
        style={{ borderColor: autoRodando ? `${autoCor}55` : autoConcluido ? "#10b98155" : "rgba(255,255,255,0.07)" }}
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Ícone */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 transition-all duration-500"
            style={{
              background: `${autoCor}18`,
              border: `1px solid ${autoCor}40`,
              boxShadow: autoRodando ? `0 0 28px ${autoCor}40` : "none",
            }}
          >
            {autoErro ? (
              <ServerCrash className="h-10 w-10" style={{ color: autoCor }} />
            ) : (
              <Zap
                className="h-10 w-10 transition-all duration-300"
                style={{ color: autoCor, filter: autoRodando ? `drop-shadow(0 0 8px ${autoCor})` : "none" }}
              />
            )}
          </div>

          <div className="flex-1 w-full text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
              <h2 className="text-xl font-bold text-white">Sincronização Automática</h2>
              <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest bg-orange-500/15 text-orange-400 border border-orange-500/25">
                Pode falhar
              </span>
            </div>
            <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
              {autoRodando
                ? autoMsg || "Sincronizando..."
                : autoErro
                  ? autoErro
                  : autoConcluido
                    ? autoMsg
                    : "O servidor tenta acessar o SUAP diretamente. Pode não funcionar se o SUAP bloquear conexões externas (redes da prefeitura)."}
            </p>
            {!autoRodando && !autoErro && !autoConcluido && (
              <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg bg-orange-500/8 border border-orange-500/20 text-orange-300/80 text-xs">
                <WifiOff className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Se aparecer erro de conexão, use o <b>Bookmarklet SUAP</b> abaixo — ele funciona sempre.</span>
              </div>
            )}

            {/* Barra de progresso auto */}
            {(autoRodando || autoConcluido) && (
              <div className="mb-4">
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${autoPct}%`,
                      background: `linear-gradient(90deg, ${autoCor}99, ${autoCor})`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs" style={{ color: autoCor }}>
                    {autoConcluido ? "Concluído!" : autoRodando ? "Sincronizando..." : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{autoPct}%</span>
                </div>
              </div>
            )}

            {/* Erro */}
            {autoErro && !autoRodando && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {autoErro}
              </div>
            )}

            {/* Progresso dos diários (modo completo) */}
            {(diariosRodando || diariosConcluido || diariosErro) && (
              <div className="mb-4">
                <p className="text-xs font-bold text-purple-400 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {diariosErro ? "Erro nos diários" : diariosConcluido ? "Diários sincronizados!" : "Sincronizando diários..."}
                </p>
                {!diariosErro && (
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-500 to-violet-500"
                      style={{ width: `${diariosPct}%` }}
                    />
                  </div>
                )}
                {diariosErro && (
                  <p className="text-xs text-red-400">{diariosErro}</p>
                )}
                {!diariosErro && (
                  <p className="text-xs text-purple-300/70">{diariosMsg}</p>
                )}
              </div>
            )}

            {/* Botão Único solicitado pelo usuário */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={autoRodando || diariosRodando ? undefined : () => {
                  setAutoErro(null); setAutoConcluido(false);
                  setModoCompleto(true); // Sincroniza tudo por padrão conforme solicitado
                  setDiariosErro(null); setDiariosConcluido(false);
                  iniciarSyncAuto();
                }}
                disabled={autoRodando || diariosRodando}
                className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-base text-white transition-all disabled:cursor-not-allowed group"
                style={{
                  background: autoRodando ? "#1e293b" : `linear-gradient(135deg, #10b981, #059669)`,
                  boxShadow: autoRodando ? "none" : "0 8px 30px rgba(16, 185, 129, 0.4)",
                  opacity: autoRodando || diariosRodando ? 0.7 : 1,
                }}
              >
                {autoRodando ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Sincronizando Dados...</>
                ) : (autoConcluido) ? (
                  <><Check className="h-5 w-5" /> Sincronização Concluída!</>
                ) : (
                  <><RefreshCcw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" /> Sincronizar Dados dos Alunos</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BLOCO 1.3 — Credenciais SUAP no Servidor
      ═══════════════════════════════════════════ */}
      <div className="bg-[#0f172a] rounded-2xl border border-white/[0.07] p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-blue-500/10 border border-blue-500/30">
            <KeyRound className="h-6 w-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-white">Credenciais SUAP no Sistema</h2>
              {credTemSenha && (
                <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest bg-green-500/15 text-green-400 border border-green-500/25">
                  Configurado
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Informe seu login e senha do SUAP para que a <b>sincronização automática via servidor</b> e o <b>Bookmarklet</b> possam funcionar sem abrir o navegador. As credenciais ficam salvas de forma segura no banco de dados do sistema.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
                  Login do SUAP
                </label>
                <Input
                  value={credUsuario}
                  onChange={e => setCredUsuario(e.target.value)}
                  placeholder="Ex: 21501"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-1.5">
                  Senha do SUAP{credTemSenha && !credSenha && <span className="ml-1.5 text-green-400 font-normal normal-case tracking-normal">✓ salva</span>}
                </label>
                <div className="relative">
                  <Input
                    type={mostrarSenha ? "text" : "password"}
                    value={credSenha}
                    onChange={e => setCredSenha(e.target.value)}
                    placeholder={credTemSenha ? "Deixe em branco para manter" : "Sua senha do SUAP"}
                    className="bg-white/5 border-white/10 text-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {credSalvo && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                <Check className="h-4 w-4" /> Credenciais salvas com sucesso!
              </div>
            )}

            <button
              onClick={salvarCredenciais}
              disabled={credSalvando || !credUsuario}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 4px 16px #3b82f640" }}
            >
              {credSalvando ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4" /> Salvar Credenciais</>}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BLOCO 1.5 — Bookmarklet SUAP (Recomendado)
      ═══════════════════════════════════════════ */}
      <div className="bg-[#0f172a] rounded-2xl border border-emerald-500/30 p-6">
        <div className="flex items-start gap-4">
          {/* Ícone */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-500/10 border border-emerald-500/30">
            <Bookmark className="h-7 w-7 text-emerald-400" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-white">Bookmarklet Inteligente</h2>
              <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                Recomendado
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              Um favorito no browser que sincroniza com o SUAP de forma automática e inteligente — tenta o servidor primeiro, e se falhar, acessa o SUAP pelo seu browser automaticamente. Gere uma vez e use sempre.
            </p>

            {/* Como funciona */}
            <div className="flex items-start gap-2 mb-4 px-3 py-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-blue-300/80 text-xs space-y-0.5">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
              <div>
                <span className="font-bold text-blue-300">Como funciona:</span>
                <span> ao clicar, tenta sincronizar via servidor. Se o servidor não alcançar o SUAP, abre o SUAP em nova aba e sincroniza direto pelo seu browser. Token válido por 1 ano.</span>
              </div>
            </div>

            {/* Passo a passo */}
            {bookmarkStatus === "idle" && (
              <div className="mb-4 space-y-1.5">
                {["1. Clique em \"Gerar Bookmarklet\" abaixo (uma única vez)",
                  "2. Arraste o botão verde para a barra de favoritos do browser",
                  "3. Clique no favorito a qualquer momento para sincronizar",
                  "4. Ele decide automaticamente o melhor método"].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="text-emerald-500 font-bold mt-0.5">›</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Botão gerado (para arrastar) */}
            {bookmarkStatus === "pronto" && bookmarkHref && (
              <div className="mb-4 p-4 rounded-xl bg-black/40 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 font-bold mb-3 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Pronto! Arraste o botão abaixo para a barra de favoritos do browser:
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Link arrastável — href definido via ref (bypass da proteção do React contra javascript: URLs) */}
                  <a
                    ref={bookmarkLinkRef}
                    draggable
                    onClick={e => e.preventDefault()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm cursor-grab active:cursor-grabbing shadow-lg shadow-emerald-500/25 select-none transition-all"
                  >
                    <Bookmark className="h-4 w-4" />
                    Sincronizar com SUAP
                  </a>
                  <button
                    onClick={copiarBookmarklet}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {bookmarkCopiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {bookmarkCopiado ? "Copiado!" : "Copiar link"}
                  </button>
                </div>
                <div className="mt-3 text-[0.7rem] text-slate-500 space-y-0.5">
                  <p>✓ Tenta servidor automaticamente • se falhar, abre SUAP e sincroniza pelo browser</p>
                  <p>✓ Token válido por 1 ano — não precisa regerar</p>
                </div>
              </div>
            )}

            {/* Botão de gerar */}
            <button
              onClick={gerarBookmarklet}
              disabled={bookmarkStatus === "gerando"}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                boxShadow: "0 4px 16px #10b98140",
              }}
            >
              {bookmarkStatus === "gerando" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
              ) : bookmarkStatus === "pronto" ? (
                <><RefreshCcw className="h-4 w-4" /> Gerar Novo</>
              ) : (
                <><Bookmark className="h-4 w-4" /> Gerar Bookmarklet</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BLOCO 2 — Sincronização via Extensão Chrome
      ═══════════════════════════════════════════ */}
      <div className="bg-[#0f172a] rounded-2xl border border-white/[0.07] p-5">
        <div className="flex items-center gap-3 mb-3">
          <RefreshCcw className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-300">Alternativa: Extensão Chrome</h3>
          <div
            className="w-2 h-2 rounded-full ml-auto"
            style={{ background: extensaoInstalada ? "#10b981" : "#64748b" }}
          />
          <span className="text-xs text-muted-foreground">
            {extensaoInstalada ? "Instalada" : "Não instalada"}
          </span>
        </div>

        {/* Barra de progresso extensão */}
        {extAtivo && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${extPct}%`, background: `linear-gradient(90deg, ${extCor}aa, ${extCor})` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: extCor }}>{syncMsg || PHASE_LABELS[syncPhase]}</span>
              <span className="text-xs text-muted-foreground">{extPct}%</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={iniciarSyncExtensao}
            disabled={!extensaoInstalada || extAtivo}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-white/8 border border-white/10 text-slate-300 hover:bg-white/12 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${extAtivo ? "animate-spin" : ""}`} />
            {extAtivo ? "Sincronizando via extensão..." : "Sincronizar via Extensão"}
          </button>

          <a
            href={`${import.meta.env.BASE_URL}suap-extension.zip?v=${downloadTs}`}
            download="suap-sync-extensao.zip"
            onClick={() => setDownloadTs(Date.now())}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-white/5 border border-white/8 text-slate-400 hover:bg-white/10 transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Baixar Extensão
          </a>
        </div>
      </div>

      {/* ── Upload Manual de XLS ── */}
      <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 p-5">
        <h3 className="text-sm font-bold text-cyan-400 mb-1 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Importar XLS Manualmente
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Baixou o arquivo XLS do SUAP manualmente? Arraste-o aqui para importar os alunos direto, sem precisar da extensão.
        </p>

        {/* Toggle substituirTudo */}
        <label className="flex items-start gap-3 cursor-pointer mb-4 p-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors group">
          <input
            type="checkbox"
            checked={substituirTudo}
            onChange={e => setSubstituirTudo(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
              Atualizar toda a lista de alunos
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Alunos que não aparecem na nova planilha serão marcados automaticamente como <span className="text-amber-400/80">Transferido/Saída</span>.
              Use ao importar uma planilha atualizada do SUAP.
            </p>
          </div>
        </label>

        <div
          className="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? "#06b6d4" : "rgba(255,255,255,0.1)",
            background: dragOver ? "rgba(6,182,212,0.07)" : "rgba(255,255,255,0.02)",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) processarArquivoXLS(file);
          }}
          onClick={() => document.getElementById("xls-upload-input")?.click()}
        >
          <input
            id="xls-upload-input"
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) processarArquivoXLS(file);
              e.target.value = "";
            }}
          />

          {uploadManual === "loading" ? (
            <div className="flex flex-col items-center gap-2 text-cyan-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">{uploadMsg}</span>
            </div>
          ) : uploadManual === "ok" ? (
            <div className="flex flex-col items-center gap-3 w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="h-6 w-6" />
                <span className="text-sm font-bold">{uploadMsg}</span>
              </div>
              {uploadDetalhes && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">{uploadDetalhes.adicionados}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Adicionados</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-blue-400">{uploadDetalhes.atualizados}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Atualizados</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-amber-400">{uploadDetalhes.transferidos}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Transferidos</p>
                    </div>
                  </div>
                  {uploadDetalhes.marcadosSaida > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-2 text-center">
                      <p className="text-sm font-bold text-orange-400">{uploadDetalhes.marcadosSaida}</p>
                      <p className="text-[10px] text-slate-400">Marcados como Transferido/Saída</p>
                    </div>
                  )}
                  {uploadDetalhes.erros > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
                      <p className="text-xs text-red-400">{uploadDetalhes.erros} linha{uploadDetalhes.erros !== 1 ? "s" : ""} com erro</p>
                    </div>
                  )}
                  <div className="text-center text-[11px] text-slate-500">
                    {uploadDetalhes.total} linhas lidas na planilha
                  </div>
                </div>
              )}
              <button
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300"
                onClick={() => { setUploadManual("idle"); setUploadMsg(""); setUploadDetalhes(null); }}
              >Importar outro arquivo</button>
            </div>
          ) : uploadManual === "error" ? (
            <div className="flex flex-col items-center gap-2 text-red-400">
              <AlertTriangle className="h-8 w-8" />
              <span className="text-sm font-semibold">{uploadMsg}</span>
              <button
                className="mt-1 text-xs text-slate-400 underline underline-offset-2"
                onClick={e => { e.stopPropagation(); setUploadManual("idle"); setUploadMsg(""); }}
              >Tentar novamente</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="h-8 w-8 mb-1" />
              <span className="text-sm font-medium text-slate-300">Arraste o arquivo XLS aqui</span>
              <span className="text-xs">ou clique para selecionar</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Upload de Professores ── */}
      <div className="bg-[#0f172a] rounded-2xl border border-violet-500/20 p-5">
        <h3 className="text-sm font-bold text-violet-400 mb-1 flex items-center gap-2">
          <Users className="h-4 w-4" /> Importar Professores (XLS)
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Baixou o relatório de professores do SUAP? Arraste o arquivo aqui para atualizar os dados dos professores cadastrados.
          Somente professores da E.M. José Giró Faísca serão importados.
        </p>

        <div
          className="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOverProf ? "#8b5cf6" : "rgba(255,255,255,0.1)",
            background: dragOverProf ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.02)",
          }}
          onDragOver={e => { e.preventDefault(); setDragOverProf(true); }}
          onDragLeave={() => setDragOverProf(false)}
          onDrop={e => { e.preventDefault(); setDragOverProf(false); const file = e.dataTransfer.files[0]; if (file) processarArquivoProfessores(file); }}
          onClick={() => { if (uploadProf !== "loading") { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xls,.xlsx"; inp.onchange = (e: any) => { const file = e.target.files?.[0]; if (file) processarArquivoProfessores(file); }; inp.click(); } }}
        >
          {uploadProf === "loading" ? (
            <div className="flex flex-col items-center gap-2 text-violet-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">{uploadProfMsg}</span>
            </div>
          ) : uploadProf === "ok" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Check className="h-6 w-6" />
                <span className="text-sm font-bold">{uploadProfMsg}</span>
              </div>
              {uploadProfDetalhes && (
                <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-emerald-400">{uploadProfDetalhes.adicionados}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Adicionados</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-400">{uploadProfDetalhes.atualizados}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Atualizados</p>
                  </div>
                  <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-400">{uploadProfDetalhes.ignorados}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ignorados</p>
                  </div>
                  <div className="col-span-3 text-center text-[11px] text-slate-500 mt-1">
                    {uploadProfDetalhes.total} linhas lidas na planilha
                  </div>
                </div>
              )}
              <button
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300"
                onClick={e => { e.stopPropagation(); setUploadProf("idle"); setUploadProfMsg(""); setUploadProfDetalhes(null); }}
              >Importar outro arquivo</button>
            </div>
          ) : uploadProf === "error" ? (
            <div className="flex flex-col items-center gap-2 text-red-400">
              <AlertTriangle className="h-8 w-8" />
              <span className="text-sm font-semibold">{uploadProfMsg}</span>
              <button
                className="mt-1 text-xs text-slate-400 underline underline-offset-2"
                onClick={e => { e.stopPropagation(); setUploadProf("idle"); setUploadProfMsg(""); }}
              >Tentar novamente</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="h-8 w-8 mb-1" />
              <span className="text-sm font-medium text-slate-300">Arraste o relatório XLS de professores</span>
              <span className="text-xs">ou clique para selecionar</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BLOCO DIÁRIOS — Sync Automático via Servidor (PDF)
      ═══════════════════════════════════════════ */}
      <BlocoDiariosServidor apiBase={window.location.origin + BASE} />

      {/* ═══════════════════════════════════════════
          BLOCO DIÁRIOS — Upload Manual de PDF
      ═══════════════════════════════════════════ */}
      <BlocoUploadPDF apiBase={window.location.origin + BASE} />

      {/* ═══════════════════════════════════════════
          BLOCO DIÁRIOS — Sincronização dos Diários via Extensão
      ═══════════════════════════════════════════ */}
      <BlocoDiariosSinc extensaoInstalada={extensaoInstalada} apiBase={window.location.origin + BASE} />

      {/* ── Histórico ── */}
      <div className="bg-[#0f172a] rounded-2xl border border-white/[0.07] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Histórico de Sincronização</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1">Última Sincronização</p>
            <p className="text-sm font-semibold text-white">{formatarData(historico?.ultimaSync)}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1">Status</p>
            <p className="text-sm font-semibold">
              {historico?.status === "idle"    && <span className="text-slate-400">Aguardando</span>}
              {historico?.status === "running" && <span className="text-yellow-400">Em execução</span>}
              {historico?.status === "success" && <span className="text-emerald-400">Concluída ✓</span>}
              {historico?.status === "error"   && <span className="text-red-400">Erro</span>}
              {!historico && <span className="text-slate-400">—</span>}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1">Alunos Importados</p>
            <p className="text-2xl font-black text-white">{historico?.totalAlunos ?? "—"}</p>
          </div>
        </div>
        {historico?.mensagem && (
          <p className="mt-3 text-xs text-muted-foreground bg-white/5 rounded-xl px-4 py-2 border border-white/5">
            {historico.mensagem}
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SEÇÃO: Cores das Turmas — com color wheel
══════════════════════════════════════════ */
interface TurmaComCor {
  id: number;
  nome_turma: string;
  turno: string | null;
  cor: string;
}

function SecaoCores() {
  const { toast } = useToast();
  const [turmas, setTurmas] = useState<TurmaComCor[]>([]);
  const [cores, setCores] = useState<Record<number, string>>({});
  const [turmaAberta, setTurmaAberta] = useState<number | null>(null);
  const [corTemp, setCorTemp] = useState<string>("#3b82f6");
  const [salvando, setSalvando] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/admin/turmas?limit=100").then((d) => {
      setTurmas(d.rows);
      const c: Record<number, string> = {};
      d.rows.forEach((t: TurmaComCor) => { c[t.id] = t.cor || "#3b82f6"; });
      setCores(c);
    }).catch(() => {});
  }, []);

  const abrirPicker = (turma: TurmaComCor) => {
    setTurmaAberta(turma.id);
    setCorTemp(cores[turma.id] ?? "#3b82f6");
  };

  const fechar = () => setTurmaAberta(null);

  const salvar = async () => {
    if (!turmaAberta) return;
    setSalvando(turmaAberta);
    setCores((c) => ({ ...c, [turmaAberta]: corTemp }));
    try {
      await apiFetch(`/admin/turmas/${turmaAberta}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cor: corTemp }),
      });
      toast({ title: "Cor salva!", description: "A cor da turma foi atualizada." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(null);
      fechar();
    }
  };

  const turmaSelecionada = turmas.find((t) => t.id === turmaAberta);

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        Clique em uma turma para abrir o seletor de cores completo — arraste para escolher qualquer cor.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {turmas.map((turma) => {
          const cor = cores[turma.id] ?? "#3b82f6";
          return (
            <button
              key={turma.id}
              onClick={() => abrirPicker(turma)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
            >
              <div
                className="w-12 h-12 rounded-2xl border-2 border-white/20 shadow-lg transition-transform group-hover:scale-110"
                style={{ background: cor, boxShadow: `0 6px 16px ${cor}55` }}
              />
              <span className="text-xs font-bold text-white">{turma.nome_turma}</span>
              <span className="text-[0.6rem] text-muted-foreground">{turma.turno ?? ""}</span>
            </button>
          );
        })}
      </div>

      {/* Modal do color picker */}
      <AnimatePresence>
        {turmaAberta !== null && turmaSelecionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={fechar} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              className="relative bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-72"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl border-2 border-white/20 shadow"
                    style={{ background: corTemp, boxShadow: `0 4px 12px ${corTemp}66` }} />
                  <div>
                    <p className="text-sm font-bold text-white">{turmaSelecionada.nome_turma}</p>
                    <p className="text-[0.6rem] text-muted-foreground">{turmaSelecionada.turno}</p>
                  </div>
                </div>
                <button onClick={fechar} className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Color Wheel — HexColorPicker do react-colorful */}
              <div className="flex flex-col items-center p-5 gap-4">
                <style>{`.react-colorful { width: 220px !important; } .react-colorful__saturation { border-radius: 12px 12px 0 0 !important; height: 160px !important; } .react-colorful__hue { border-radius: 8px !important; height: 18px !important; margin-top: 12px; } .react-colorful__pointer { width: 22px !important; height: 22px !important; border-width: 3px !important; }`}</style>
                <HexColorPicker color={corTemp} onChange={setCorTemp} />

                {/* Input de hex manual */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-muted-foreground font-mono">#</span>
                  <HexColorInput
                    color={corTemp}
                    onChange={setCorTemp}
                    prefixed={false}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="w-9 h-9 rounded-xl border border-white/20 shrink-0"
                    style={{ background: corTemp }} />
                </div>

                {/* Preview ao vivo */}
                <div className="w-full rounded-xl p-3 flex items-center gap-2" style={{ background: `${corTemp}20`, border: `1px solid ${corTemp}44` }}>
                  <div className="w-6 h-6 rounded-full" style={{ background: corTemp }} />
                  <span className="text-sm font-bold" style={{ color: corTemp }}>
                    Cor da turma {turmaSelecionada.nome_turma}
                  </span>
                </div>

                {/* Botões */}
                <div className="flex gap-2 w-full">
                  <Button variant="ghost" onClick={fechar} className="flex-1 text-muted-foreground">
                    Cancelar
                  </Button>
                  <Button onClick={salvar} disabled={salvando === turmaAberta} className="flex-1 gap-2"
                    style={{ background: corTemp, color: "#fff" }}>
                    {salvando === turmaAberta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ══════════════════════════════════════════
   MODAL DE EDIÇÃO — PROFESSORES (especializado)
══════════════════════════════════════════ */
interface TurmaOpcao { id: number; nome_turma: string; turno: string | null; }

interface ModalEdicaoProfessorProps {
  linha: Record<string, any> | null;
  onClose: () => void;
  onSalvo: () => void;
}

const CAMPOS_PROFESSOR = [
  { key: "nome",               label: "Nome",              tipo: "texto",   obrig: true  },
  { key: "matricula",          label: "Matrícula",         tipo: "texto",   obrig: false },
  { key: "cpf",                label: "CPF",               tipo: "texto",   obrig: false },
  { key: "telefone",           label: "Telefone",          tipo: "texto",   obrig: false },
  { key: "vinculo",            label: "Vínculo",           tipo: "texto",   obrig: false },
  { key: "email",              label: "E-mail",            tipo: "texto",   obrig: false },
  { key: "data_nascimento",    label: "Nascimento",        tipo: "texto",   obrig: false },
  { key: "identificacao_censo",label: "Código Censo",      tipo: "texto",   obrig: false },
] as const;

function ModalEdicaoProfessor({ linha, onClose, onSalvo }: ModalEdicaoProfessorProps) {
  const { toast } = useToast();
  const isNovo = !linha;
  const [form, setForm] = useState<Record<string, any>>(linha ?? {});
  const [salvando, setSalvando] = useState(false);
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [fotoPreview, setFotoPreview] = useState<string | null>(linha?.foto ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/admin/turmas?limit=100")
      .then((d) => setTurmas(d.rows))
      .catch(() => {});
  }, []);

  const turmasManha = turmas.filter((t) => t.turno === "Manhã");
  const turmasTarde = turmas.filter((t) => t.turno === "Tarde");

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const processarImagem = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFotoPreview(dataUrl);
      set("foto", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processarImagem(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) processarImagem(file);
  };

  const removerFoto = () => {
    setFotoPreview(null);
    set("foto", null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (isNovo) {
        await apiFetch("/admin/professores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Professor criado com sucesso!" });
      } else {
        await apiFetch(`/admin/professores/${linha!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Professor atualizado!" });
      }
      onSalvo();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const selectCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <UserCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-base font-bold text-white">
              {isNovo ? "Novo Professor" : `Editar Professor — ${linha?.nome ?? `ID ${linha?.id}`}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* ── Área de Foto ── */}
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Foto
            </label>
            {fotoPreview ? (
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <img src={fotoPreview} alt="Foto do professor"
                    className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-lg" />
                  <button onClick={removerFoto}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 border border-white/20 flex items-center justify-center shadow"
                    title="Remover foto">
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-colors">
                    <ImagePlus className="h-4 w-4 text-emerald-400" /> Trocar foto
                  </button>
                  <button onClick={() => cameraRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white transition-colors">
                    <Camera className="h-4 w-4 text-blue-400" /> Câmera
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-white/15 hover:border-emerald-500/40 rounded-2xl p-6 transition-colors cursor-pointer group"
                onClick={() => fileRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-emerald-500/10 border border-white/10 flex items-center justify-center transition-colors">
                    <ImagePlus className="h-6 w-6 text-white/30 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/60 group-hover:text-white/80 transition-colors">
                      Arraste uma foto aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-white/30 mt-1">JPG, PNG, WEBP — qualquer tamanho</p>
                  </div>
                  <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-400 font-medium transition-colors">
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </button>
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-xs text-blue-400 font-medium transition-colors">
                      <Camera className="h-3.5 w-3.5" /> Câmera
                    </button>
                  </div>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
          </div>

          {/* ── Turno ── */}
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Turno
            </label>
            <div className="relative">
              <select
                value={form.turno ?? ""}
                onChange={(e) => set("turno", e.target.value || null)}
                className={selectCls}
              >
                <option value="" className="bg-[#1e293b] text-white/50">— Selecionar turno —</option>
                <option value="Manhã" className="bg-[#1e293b] text-white">Manhã</option>
                <option value="Tarde" className="bg-[#1e293b] text-white">Tarde</option>
                <option value="Manhã e Tarde" className="bg-[#1e293b] text-white">Manhã e Tarde</option>
              </select>
              <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 h-4 w-4 text-white/30" />
            </div>
          </div>

          {/* ── Turmas ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Turma Manhã
              </label>
              <div className="relative">
                <select
                  value={form.turma_manha ?? ""}
                  onChange={(e) => set("turma_manha", e.target.value || null)}
                  className={selectCls}
                >
                  <option value="" className="bg-[#1e293b] text-white/50">— Nenhuma —</option>
                  {turmasManha.map((t) => (
                    <option key={t.id} value={t.nome_turma} className="bg-[#1e293b] text-white">
                      {t.nome_turma}
                    </option>
                  ))}
                </select>
                <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 h-4 w-4 text-white/30" />
              </div>
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Turma Tarde
              </label>
              <div className="relative">
                <select
                  value={form.turma_tarde ?? ""}
                  onChange={(e) => set("turma_tarde", e.target.value || null)}
                  className={selectCls}
                >
                  <option value="" className="bg-[#1e293b] text-white/50">— Nenhuma —</option>
                  {turmasTarde.map((t) => (
                    <option key={t.id} value={t.nome_turma} className="bg-[#1e293b] text-white">
                      {t.nome_turma}
                    </option>
                  ))}
                </select>
                <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 h-4 w-4 text-white/30" />
              </div>
            </div>
          </div>

          {/* ── Campos de texto ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAMPOS_PROFESSOR.map((campo) => (
              <div key={campo.key}>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  {campo.label}
                </label>
                <Input
                  type="text"
                  value={form[campo.key] ?? ""}
                  onChange={(e) => set(campo.key, e.target.value)}
                  className="bg-white/5 border-white/10 focus-visible:ring-emerald-500/30 text-white"
                  placeholder={campo.obrig ? "Obrigatório" : "Opcional"}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MODAL DE EDIÇÃO — TURMAS (especializado)
══════════════════════════════════════════ */
interface ProfessorOpcao { id: number; nome: string; turno: string | null; }

interface ModalEdicaoTurmaProps {
  linha: Record<string, any> | null;
  onClose: () => void;
  onSalvo: () => void;
}

const SLOTS_PROF = [
  { key: "professor_responsavel", label: "Regente (Professor Responsável)", cor: "#8b5cf6" },
  { key: "prof_complementador",   label: "Professor Complementador",        cor: "#10b981" },
  { key: "prof_educacao_fisica",  label: "Professor de Ed. Física",         cor: "#f59e0b" },
  { key: "auxiliar_turma",        label: "Auxiliar de Turma",               cor: "#3b82f6" },
] as const;

function ModalEdicaoTurma({ linha, onClose, onSalvo }: ModalEdicaoTurmaProps) {
  const { toast } = useToast();
  const isNovo = !linha;
  const [form, setForm] = useState<Record<string, any>>(linha ?? {});
  const [salvando, setSalvando] = useState(false);
  const [professores, setProfessores] = useState<ProfessorOpcao[]>([]);

  useEffect(() => {
    apiFetch("/admin/professores?limit=200")
      .then((d) => setProfessores(d.rows))
      .catch(() => {});
  }, []);

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (isNovo) {
        await apiFetch("/admin/turmas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Turma criada com sucesso!" });
      } else {
        await apiFetch(`/admin/turmas/${linha!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Turma atualizada!" });
      }
      onSalvo();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const selectCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 appearance-none cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-white">
              {isNovo ? "Nova Turma" : `Editar Turma — ${linha?.nome_turma ?? `ID ${linha?.id}`}`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Nome + Turno + Cor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Nome da Turma *
              </label>
              <Input
                value={form.nome_turma ?? ""}
                onChange={(e) => set("nome_turma", e.target.value)}
                className="bg-white/5 border-white/10 focus-visible:ring-violet-500/30 text-white"
                placeholder="Ex: 6º A, 7º B..."
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Turno
              </label>
              <div className="relative">
                <select
                  value={form.turno ?? ""}
                  onChange={(e) => set("turno", e.target.value || null)}
                  className={selectCls}
                >
                  <option value="" className="bg-[#1e293b] text-white/50">— Selecionar —</option>
                  <option value="Manhã" className="bg-[#1e293b] text-white">Manhã</option>
                  <option value="Tarde" className="bg-[#1e293b] text-white">Tarde</option>
                </select>
                <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 h-4 w-4 text-white/30" />
              </div>
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Cor da Turma
            </label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.cor ?? "#3b82f6"}
                onChange={(e) => set("cor", e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
              <Input value={form.cor ?? "#3b82f6"}
                onChange={(e) => set("cor", e.target.value)}
                className="bg-white/5 border-white/10 focus-visible:ring-violet-500/30 text-white font-mono w-36" />
              <div className="flex-1 h-9 rounded-xl border border-white/10"
                style={{ background: `${form.cor ?? "#3b82f6"}33` }}>
                <div className="h-full rounded-xl opacity-60" style={{ background: form.cor ?? "#3b82f6" }} />
              </div>
            </div>
          </div>

          {/* Professores */}
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Professores da Turma
            </label>
            <div className="space-y-3">
              {SLOTS_PROF.map((slot) => (
                <div key={slot.key} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ background: slot.cor }} />
                  <div className="flex-1">
                    <label className="block text-[0.6rem] font-semibold uppercase tracking-wider mb-1"
                      style={{ color: slot.cor }}>
                      {slot.label}
                    </label>
                    <div className="relative">
                      <select
                        value={form[slot.key] ?? ""}
                        onChange={(e) => set(slot.key, e.target.value || null)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none appearance-none cursor-pointer"
                        style={{ "--tw-ring-color": `${slot.cor}44` } as React.CSSProperties}
                      >
                        <option value="" className="bg-[#1e293b] text-white/50">— Nenhum —</option>
                        {professores.map((p) => (
                          <option key={p.id} value={p.nome} className="bg-[#1e293b] text-white">
                            {p.nome}{p.turno ? ` (${p.turno})` : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronLeft className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-90 h-4 w-4 text-white/30" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {professores.length === 0 && (
              <p className="text-xs text-white/30 mt-2">Carregando professores...</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}
            className="gap-2 bg-violet-600 hover:bg-violet-500 text-white">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MODAL DE EDIÇÃO — senha em texto simples
══════════════════════════════════════════ */
interface ModalEdicaoProps {
  tabela: string;
  colunas: any[];
  linha: Record<string, any> | null;
  onClose: () => void;
  onSalvo: () => void;
}

function ModalEdicao({ tabela, colunas, linha, onClose, onSalvo }: ModalEdicaoProps) {
  const { toast } = useToast();
  const isNovo = !linha;
  const [form, setForm] = useState<Record<string, any>>(linha ?? {});
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      if (isNovo) {
        await apiFetch(`/admin/${tabela}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Registro criado com sucesso!" });
      } else {
        await apiFetch(`/admin/${tabela}/${linha!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Registro atualizado!" });
      }
      onSalvo();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const editaveis = colunas.filter((c) => c.column_name !== "id");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#111827] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-bold text-white">
            {isNovo ? "Novo Registro" : `Editar — ID ${linha?.id}`}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editaveis.map((col) => (
              <div key={col.column_name}>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  {LABEL[col.column_name] ?? col.column_name}
                </label>
                {col.column_name === "cor" ? (
                  <div className="flex items-center gap-2">
                    <input type="color" value={form[col.column_name] ?? "#3b82f6"}
                      onChange={(e) => setForm((f) => ({ ...f, [col.column_name]: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                    <Input value={form[col.column_name] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [col.column_name]: e.target.value }))}
                      className="bg-white/5 border-white/10 focus-visible:ring-primary/30 text-white font-mono" />
                  </div>
                ) : (
                  /* senha: sempre tipo text (sem bolinhas) para qualquer tabela */
                  <Input
                    type="text"
                    value={form[col.column_name] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [col.column_name]: e.target.value }))}
                    className="bg-white/5 border-white/10 focus-visible:ring-primary/30 text-white"
                    placeholder={col.is_nullable === "YES" ? "Opcional" : "Obrigatório"}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10 shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function ModalConfirmar({ onConfirmar, onCancelar }: { onConfirmar: () => void; onCancelar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancelar} />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="relative bg-[#111827] border border-red-500/30 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Excluir registro?</h3>
        <p className="text-sm text-muted-foreground mb-5">Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
          <Button variant="destructive" onClick={onConfirmar} className="bg-red-500 hover:bg-red-600">Excluir</Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SEÇÃO: Editar Tabela — senha visível em usuários
══════════════════════════════════════════ */
function SecaoEditarTabela({ tabela }: { tabela: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [colunas, setColunas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState<Record<string, any> | "novo" | undefined>(undefined);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const LIMIT = 50;
  const totalPags = Math.ceil(total / LIMIT);
  const colsDestaque = COLUNAS_DESTAQUE[tabela] ?? ["id"];
  const menuItem = MENU.find((m) => TABELA_KEY[tabela] === m.id);
  const cor = menuItem?.cor ?? "#3b82f6";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set("search", search);
      const data = await apiFetch(`/admin/${tabela}?${params}`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e: any) {
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tabela, page, search]);

  const carregarColunas = useCallback(async () => {
    try {
      const data = await apiFetch(`/admin/${tabela}/colunas`);
      setColunas(data);
    } catch {}
  }, [tabela]);

  useEffect(() => { setPage(1); setSearch(""); setSearchInput(""); }, [tabela]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarColunas(); }, [carregarColunas]);

  const handleExcluir = async (id: number) => {
    try {
      await apiFetch(`/admin/${tabela}/${id}`, { method: "DELETE" });
      toast({ title: "Registro excluído." });
      setExcluindo(null);
      carregar();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
      setExcluindo(null);
    }
  };

  const buscar = () => { setPage(1); setSearch(searchInput); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            className="pl-10 bg-white/5 border-white/10 focus-visible:ring-primary/30" />
        </div>
        <Button onClick={buscar} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">Buscar</Button>
        <div className="flex-1" />
        <Button onClick={() => setEditando("novo")} className="gap-2" style={{ background: cor }}>
          <Plus className="h-4 w-4" />Novo
        </Button>
      </div>

      <div className="bg-[#0f172a] rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {loading ? "Carregando..." : `${total} registro${total !== 1 ? "s" : ""}`}
          </span>
          {search && (
            <button onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="text-xs text-primary hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>

        <div className="overflow-auto max-h-[55vh] sm:max-h-[calc(100vh-380px)]" style={{ WebkitOverflowScrolling: "touch" }}>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum registro encontrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0a0f1a] z-10">
                <tr>
                  {colsDestaque.map((col) => (
                    <th key={col} className="text-left px-3 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap border-b border-white/5">
                      {LABEL[col] ?? col}
                    </th>
                  ))}
                  <th className="px-3 py-3 border-b border-white/5 text-right text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const ehTransf = tabela === "alunos" && /transfer|remanej/i.test(String(row.situacao ?? ""));
                  return (
                  <tr key={row.id} className={cn(
                    "border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group",
                    i % 2 !== 0 && "bg-white/[0.01]",
                    ehTransf && "opacity-50"
                  )}>
                    {colsDestaque.map((col) => (
                      <td key={col} className="px-3 py-2.5 text-white/80 whitespace-nowrap max-w-[160px] sm:max-w-[200px] truncate text-xs sm:text-sm">
                        {col === "id" ? (
                          <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: `${cor}22`, color: cor }}>
                            {row[col]}
                          </span>
                        ) : col === "cor" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md border border-white/20" style={{ background: row[col] ?? "#3b82f6" }} />
                            <span className="font-mono text-xs text-muted-foreground">{row[col] ?? "—"}</span>
                          </div>
                        ) : col === "senha" ? (
                          <span className="font-mono text-xs text-amber-300/90 tracking-wide">
                            {row[col] ?? "—"}
                          </span>
                        ) : col === "nome_completo" && ehTransf ? (
                          <div className="flex items-center gap-2">
                            <span className="truncate">{String(row[col] ?? "—")}</span>
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              Transferido
                            </span>
                          </div>
                        ) : (
                          String(row[col] ?? "—")
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditando(row)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ background: `${cor}22`, color: cor }} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setExcluindo(row.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalPags > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-muted-foreground">Página {page} de {totalPags}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-30 transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPags, p + 1))} disabled={page === totalPags}
                className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white disabled:opacity-30 transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editando !== undefined && tabela === "professores" && (
          <ModalEdicaoProfessor
            linha={editando === "novo" ? null : (editando as Record<string, any>)}
            onClose={() => setEditando(undefined)} onSalvo={carregar} />
        )}
        {editando !== undefined && tabela === "turmas" && (
          <ModalEdicaoTurma
            linha={editando === "novo" ? null : (editando as Record<string, any>)}
            onClose={() => setEditando(undefined)} onSalvo={carregar} />
        )}
        {editando !== undefined && tabela !== "professores" && tabela !== "turmas" && colunas.length > 0 && (
          <ModalEdicao tabela={tabela} colunas={colunas}
            linha={editando === "novo" ? null : (editando as Record<string, any>)}
            onClose={() => setEditando(undefined)} onSalvo={carregar} />
        )}
        {excluindo !== null && (
          <ModalConfirmar onConfirmar={() => handleExcluir(excluindo!)} onCancelar={() => setExcluindo(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════
   SEÇÃO: Logins Externos
══════════════════════════════════════════ */
interface LoginExterno {
  id: number; nomeSite: string; url?: string | null;
  login: string; senha: string; descricao?: string | null;
}

function SecaoLogins() {
  const [logins, setLogins] = useState<LoginExterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [senhasVisiveis, setSenhasVisiveis] = useState<Set<number>>(new Set());
  const [copiados, setCopiados] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<LoginExterno | null>(null);
  const [form, setForm] = useState({ nomeSite: "", url: "", login: "", senha: "", descricao: "" });

  async function carregar() {
    try { const r = await apiFetch("/logins-externos"); setLogins(r); }
    finally { setLoading(false); }
  }
  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setEditando(null); setForm({ nomeSite: "", url: "", login: "", senha: "", descricao: "" }); setDialogOpen(true); }
  function abrirEditar(l: LoginExterno) { setEditando(l); setForm({ nomeSite: l.nomeSite, url: l.url ?? "", login: l.login, senha: l.senha, descricao: l.descricao ?? "" }); setDialogOpen(true); }

  async function salvar() {
    if (!form.nomeSite || !form.login || !form.senha) return;
    const path  = editando ? `/logins-externos/${editando.id}` : "/logins-externos";
    const method = editando ? "PUT" : "POST";
    await apiFetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setDialogOpen(false); carregar();
  }

  async function excluir(id: number) {
    if (!confirm("Remover este login?")) return;
    await apiFetch(`/logins-externos/${id}`, { method: "DELETE" });
    carregar();
  }

  function toggleSenha(id: number) {
    setSenhasVisiveis(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function copiar(texto: string, chave: string) {
    await navigator.clipboard.writeText(texto);
    setCopiados(prev => new Set(prev).add(chave));
    setTimeout(() => setCopiados(prev => { const s = new Set(prev); s.delete(chave); return s; }), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-7 w-7 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-sm">Logins de sites externos para acesso rápido e automação</p>
        <Button onClick={abrirNovo} size="sm" className="bg-orange-500/80 hover:bg-orange-500 gap-1.5 text-white">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {logins.length === 0 ? (
        <div className="py-12 text-center text-white/30 border border-white/5 rounded-2xl border-dashed">
          <Globe className="h-9 w-9 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum login salvo</p>
          <p className="text-xs mt-1 opacity-60">Adicione logins de portais externos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logins.map(l => (
            <div key={l.id} className="p-4 bg-[#0f172a] rounded-2xl border border-white/[0.07] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Globe className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{l.nomeSite}</p>
                    {l.descricao && <p className="text-xs text-white/35 mt-0.5">{l.descricao}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {l.url && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white" onClick={() => window.open(l.url!, "_blank")} title="Abrir site">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white" onClick={() => abrirEditar(l)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/40 hover:text-red-400" onClick={() => excluir(l.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <span className="text-[10px] text-white/25 uppercase tracking-wider w-10 shrink-0">Login</span>
                  <span className="text-xs text-white/75 flex-1 font-mono truncate">{l.login}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-white/25 hover:text-white shrink-0" onClick={() => copiar(l.login, `login-${l.id}`)}>
                    {copiados.has(`login-${l.id}`) ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <span className="text-[10px] text-white/25 uppercase tracking-wider w-10 shrink-0">Senha</span>
                  <span className="text-xs text-white/75 flex-1 font-mono truncate">{senhasVisiveis.has(l.id) ? l.senha : "••••••••"}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-white/25 hover:text-white shrink-0" onClick={() => toggleSenha(l.id)}>
                    {senhasVisiveis.has(l.id) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-white/25 hover:text-white shrink-0" onClick={() => copiar(l.senha, `senha-${l.id}`)}>
                    {copiados.has(`senha-${l.id}`) ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editando ? "Editar Login" : "Novo Login Externo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider">Nome do Site *</Label>
              <Input value={form.nomeSite} onChange={e => setForm(f => ({ ...f, nomeSite: e.target.value }))} className="mt-1 bg-background/50 border-white/10 text-white" placeholder="Ex: SMAEC, SUAP, Diário Escolar" />
            </div>
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider">URL do Site</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="mt-1 bg-background/50 border-white/10 text-white" placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60 text-xs uppercase tracking-wider">Login / Usuário *</Label>
                <Input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} className="mt-1 bg-background/50 border-white/10 text-white" placeholder="Usuário" />
              </div>
              <div>
                <Label className="text-white/60 text-xs uppercase tracking-wider">Senha *</Label>
                <Input type="text" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} className="mt-1 bg-background/50 border-white/10 text-white" placeholder="Senha" />
              </div>
            </div>
            <div>
              <Label className="text-white/60 text-xs uppercase tracking-wider">Observação</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="mt-1 bg-background/50 border-white/10 text-white resize-none" rows={2} placeholder="Ex: login da direção para baixar históricos" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-400" onClick={salvar} disabled={!form.nomeSite || !form.login || !form.senha}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════
   SEÇÃO: Configurações do Diário de Classe
══════════════════════════════════════════ */
function SecaoConfigDiario() {
  const { toast } = useToast();
  const [ficaiConsec, setFicaiConsec]   = useState<string>("3");
  const [ficaiMensais, setFicaiMensais] = useState<string>("5");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(API("/diario/configuracoes"), { credentials: "include" })
      .then((r) => r.json())
      .then((cfg) => {
        setFicaiConsec(cfg.ficai_faltas_consecutivas ?? "3");
        setFicaiMensais(cfg.ficai_faltas_mensais ?? "5");
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await apiFetch("/diario/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: "ficai_faltas_consecutivas", valor: ficaiConsec }),
      });
      await apiFetch("/diario/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave: "ficai_faltas_mensais", valor: ficaiMensais }),
      });
      toast({ title: "Configurações salvas com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
    </div>
  );

  return (
    <div className="max-w-lg space-y-8">
      {/* FICAI */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Alerta FICAI</h3>
            <p className="text-xs text-muted-foreground">
              Ficha de Comunicação do Aluno Infrequente
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 font-medium">
            Dias letivos consecutivos sem comparecer
          </label>
          <select
            value={ficaiConsec}
            onChange={(e) => setFicaiConsec(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {[2,3,4,5,6].map((n) => (
              <option key={n} value={String(n)}>
                {n} dias letivos seguidos
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Aluno ausente por esta quantidade de dias letivos consecutivos (independente da semana).
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 font-medium">
            Total de faltas no mês atual
          </label>
          <select
            value={ficaiMensais}
            onChange={(e) => setFicaiMensais(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {[3,4,5,6,7,8,10].map((n) => (
              <option key={n} value={String(n)}>
                {n} faltas totais no mês
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Aluno com esta quantidade de faltas acumuladas no mês corrente.
          </p>
        </div>

        <p className="text-xs text-orange-300/70 bg-orange-950/40 border border-orange-700/30 rounded-lg px-3 py-2">
          O alerta FICAI aparece se <strong>qualquer um</strong> dos critérios for atingido.
        </p>
      </div>

      <Button onClick={salvar} disabled={salvando} className="gap-2">
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Salvar configurações
      </Button>
    </div>
  );
}

export default function AjustesPage() {
  const [secao, setSecao] = useState<SecaoId>("sincronizacao");
  const ativo = MENU.find((m) => m.id === secao)!;

  const renderConteudo = () => {
    switch (secao) {
      case "sincronizacao":  return <SecaoSincronizacao />;
      case "cores":          return <SecaoCores />;
      case "alunos":         return <SecaoEditarTabela tabela="alunos" />;
      case "turmas":         return <SecaoEditarTabela tabela="turmas" />;
      case "professores":    return <SecaoEditarTabela tabela="professores" />;
      case "funcionarios":   return <SecaoEditarTabela tabela="funcionarios" />;
      case "usuarios":       return <SecaoEditarTabela tabela="usuarios" />;
      case "logins":         return <SecaoLogins />;
      case "diario":         return <SecaoConfigDiario />;
    }
  };

  return (
    <AppLayout>
      <div className="flex gap-6 h-full pb-8">

        {/* Menu lateral */}
        <aside className="w-56 shrink-0 space-y-1">
          <div className="flex items-center gap-2 px-3 mb-4">
            <Settings2 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-white">Ajustes</h1>
          </div>
          {MENU.map((item) => {
            const Icone = item.icon;
            const isAtivo = secao === item.id;
            return (
              <button key={item.id} onClick={() => setSecao(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group",
                  isAtivo ? "text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
                style={isAtivo
                  ? { background: `${item.cor}20`, borderLeft: `3px solid ${item.cor}` }
                  : { borderLeft: "3px solid transparent" }}
              >
                <Icone className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110"
                  style={isAtivo ? { color: item.cor } : {}} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${ativo.cor}20` }}>
              <ativo.icon className="h-5 w-5" style={{ color: ativo.cor }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{ativo.label}</h2>
              <p className="text-xs text-muted-foreground">{ativo.desc}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={secao}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}>
              {renderConteudo()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}

// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Users, BookOpen, UserCircle, Briefcase, KeyRound,
  Search, Plus, Pencil, Trash2, Loader2, X, Save,
  ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Palette,
  RefreshCcw, Check, Settings2, Eye, EyeOff,
  Globe, Copy, ExternalLink, Upload, FileSpreadsheet,
  Zap, ServerCrash, Camera, ImagePlus, Bookmark, ShieldCheck, WifiOff, MessageCircle, PlayCircle,
  Mail, Phone, FileText, Link2, Sun, Sunset, GraduationCap, Printer, Wifi
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
import { useSyncGlobal } from "@/contexts/SyncContext";

/* ─── Menu ─── */
type SecaoId =
  | "sincronizacao" | "cores" | "alunos"
  | "turmas" | "professores" | "funcionarios" | "usuarios" | "contatos" | "diario" | "whatsapp";

const MENU: { id: SecaoId; label: string; icon: React.ElementType; desc: string; cor: string }[] = [
  { id: "sincronizacao", label: "Sincronização",    icon: RefreshCcw,  desc: "Integração com o SUAP",             cor: "#06b6d4" },
  { id: "cores",         label: "Cores das Turmas", icon: Palette,     desc: "Personalizar cor de cada turma",    cor: "#a855f7" },
  { id: "alunos",        label: "Editar Alunos",    icon: Users,       desc: "Gerenciar cadastro de alunos",      cor: "#3b82f6" },
  { id: "turmas",        label: "Editar Turmas",    icon: BookOpen,    desc: "Gerenciar turmas e responsáveis",   cor: "#8b5cf6" },
  { id: "professores",   label: "Editar Professores",icon: UserCircle, desc: "Gerenciar corpo docente",           cor: "#10b981" },
  { id: "funcionarios",  label: "Editar Funcionários",icon: Briefcase, desc: "Gerenciar equipe administrativa",   cor: "#f59e0b" },
  { id: "usuarios",      label: "Editar Usuários",  icon: KeyRound,    desc: "Gerenciar acessos ao sistema",      cor: "#ef4444" },
  { id: "contatos",      label: "Contatos e E-mail", icon: Mail,       desc: "E-mail, WhatsApp e IPs da escola", cor: "#f97316" },
  { id: "diario",        label: "Config. Diário",   icon: BookOpen,    desc: "Configurações do Diário de Classe", cor: "#10b981" },
  { id: "whatsapp",      label: "Bot do WhatsApp",  icon: MessageCircle, desc: "Sincronizar número da escola",  cor: "#22c55e" },
];

const TABELA_KEY: Record<string, string> = {
  alunos: "alunos", turmas: "turmas", professores: "professores",
  funcionarios: "funcionarios", usuarios: "usuarios",
};

const COLUNAS_DESTAQUE: Record<string, string[]> = {
  alunos:       ["id","matricula","nome_completo","turma_atual","turno","situacao"],
  turmas:       ["id","nome_turma","turno","qtd_alunos","professor_responsavel","prof_complementador","prof_educacao_fisica"],
  professores:  ["id","nome","turno","turma_manha","turma_tarde","telefone","vinculo"],
  funcionarios: ["id","matricula","nome_completo","funcao","turno","status","vinculo"],
  usuarios:     ["id","nome_completo","login","senha","perfil"],
};

const LABEL: Record<string, string> = {
  id:"ID", matricula:"Matrícula", nome_completo:"Nome", nome:"Nome",
  turma_atual:"Turma", turno:"Turno", situacao:"Situação",
  nome_turma:"Turma", qtd_alunos:"Alunos", professor_responsavel:"Prof. Responsável",
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

const obterHtmlLogSinc = (log: any) => {
  let html = `<p><strong>Data:</strong> ${new Date(log.ultimaSync).toLocaleString("pt-BR")}</p>`;
  html += `<p><strong>Resumo:</strong> ${log.mensagem}</p>`;
  if (log.detalhes) {
    if (log.detalhes.adicionados?.length > 0) {
      html += `<h2>Novos Alunos (${log.detalhes.adicionados.length})</h2><ul>`;
      log.detalhes.adicionados.forEach((nome: string) => { html += `<li>${nome}</li>`; });
      html += `</ul>`;
    }
    if (log.detalhes.atualizados?.length > 0) {
      html += `<h2>Dados Atualizados (${log.detalhes.atualizados.length})</h2><ul>`;
      log.detalhes.atualizados.forEach((nome: string) => { html += `<li>${nome}</li>`; });
      html += `</ul>`;
    }
    if (log.detalhes.transferidos?.length > 0) {
      html += `<h2>Saídas/Transferidos (${log.detalhes.transferidos.length})</h2><ul>`;
      log.detalhes.transferidos.forEach((nome: string) => { html += `<li>${nome}</li>`; });
      html += `</ul>`;
    }
  }
  return html;
};

const obterHtmlLogWhatsApp = (logsArr: string[]) => {
  return `<h2>Logs de Fluxo do Bot</h2><pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all;">${logsArr.join("\n")}</pre>`;
};

const imprimirLogOnline = async (impressora: "RICOH" | "EPSON", titulo: string, htmlConteudo: string, toast: any) => {
  try {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
          h1 { font-size: 18px; border-bottom: 2px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
          h2 { font-size: 14px; margin-top: 20px; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          ul { padding-left: 20px; margin-top: 6px; }
          li { font-size: 12px; margin-bottom: 3px; }
          p { font-size: 13px; margin: 4px 0; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
        </style>
      </head>
      <body>
        <h1>${titulo}</h1>
        ${htmlConteudo}
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const file = new File([blob], `Log_${titulo.replace(/\s+/g, "_")}.html`, { type: "text/html" });

    const form = new FormData();
    form.append("professorSolicitante", "Sistema (Log)");
    form.append("quantidadeCopias", "1");
    form.append("impressoraNome", impressora);
    form.append("colorida", impressora === "EPSON" ? "true" : "false");
    form.append("arquivo", file);

    const res = await fetch(API("/impressoes"), { method: "POST", body: form });
    if (!res.ok) throw new Error("Erro ao enviar");
    toast({ title: `Enviado para ${impressora} (Online) com sucesso!` });
  } catch (err) {
    console.error(err);
    toast({ title: "Erro ao tentar imprimir online.", variant: "destructive" });
  }
};

const imprimirLogLocal = (titulo: string, htmlConteudo: string, toast: any) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast({ title: "Bloqueador de popup ativo", description: "Permita popups para imprimir.", variant: "destructive" });
    return;
  }
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
        h1 { font-size: 18px; border-bottom: 2px solid #ccc; padding-bottom: 8px; margin-bottom: 12px; }
        h2 { font-size: 14px; margin-top: 20px; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        ul { padding-left: 20px; margin-top: 6px; }
        li { font-size: 12px; margin-bottom: 3px; }
        p { font-size: 13px; margin: 4px 0; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
        @media print {
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px; display: flex; gap: 10px;">
        <button onclick="window.print()" style="padding: 6px 12px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px;">Imprimir (Ctrl+P)</button>
        <button onclick="window.close()" style="padding: 6px 12px; cursor: pointer; background: #e2e8f0; color: #334155; border: none; border-radius: 4px; font-size: 12px;">Fechar</button>
      </div>
      <h1>${titulo}</h1>
      ${htmlConteudo}
    </body>
    </html>
  `;
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

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

  // Estados para histórico e log detalhado
  const [historicoList, setHistoricoList] = useState<any[]>([]);
  const [logAberto, setLogAberto] = useState<any | null>(null);

  const carregarHistorico = useCallback(async () => {
    try {
      const data = await apiFetch("/sync/historico");
      setHistoricoList(data);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    }
  }, [apiBase]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

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
  const syncGlobal = useSyncGlobal();

  // ── Turmas carregadas da API ──────────────────────────────────────────────
  const [turmas, setTurmas] = useState<any[]>([]);
  const [carregandoTurmas, setCarregandoTurmas] = useState(true);

  // ── Estado de diálogo para editar link de turma individual ─────────────────
  const [dialogTurma, setDialogTurma] = useState<any | null>(null);

  // ── Links por turma: Record<turmaId, link> ────────────────────────────────
  const [linksPerTurma, setLinksPerTurma] = useState<Record<number, string>>({});
  const [linksDirty, setLinksDirty] = useState<Record<number, boolean>>({});   // quais foram alterados
  const [salvandoTodos, setSalvandoTodos] = useState(false);
  const [autoSalvar, setAutoSalvar] = useState(false);

  // ── Estado de download por turma ──────────────────────────────────────────
  const [baixandoPorTurma, setBaixandoPorTurma] = useState<Record<number, { phase: "baixando"|"done"|"error"; msg: string }>>({});

  // ── Metadata dos links (ultimaSync) ───────────────────────────────────────
  type LinkMeta = { link: string; turma: string | null; ultimaSync: string | null; status: string | null };
  const [linksMeta, setLinksMeta] = useState<LinkMeta[]>([]);

  // ── Sincronização global (extensão) ───────────────────────────────────────
  const [phase, setPhase]         = useState<DiarioSyncPhase>("idle");
  const [msg, setMsg]             = useState("");
  const [progAtual, setProgAtual] = useState(0);
  const [progTotal, setProgTotal] = useState(0);
  const [resultados, setResultados] = useState<any[]>([]);
  const [showResultados, setShowResultados] = useState(false);

  // ── Carrega turmas + links salvos ─────────────────────────────────────────
  const carregarTurmas = useCallback(async () => {
    setCarregandoTurmas(true);
    try {
      const r = await fetch(`${apiBase}/api/diario/turmas`, { credentials: "include" });
      const data: any[] = await r.json();
      setTurmas(Array.isArray(data) ? data : []);

      // Pré-preenche os campos com links já salvos em cada turma
      const initialLinks: Record<number, string> = {};
      for (const t of data) {
        if (t.linkSuap) initialLinks[t.id] = t.linkSuap;
      }
      setLinksPerTurma(prev => ({ ...initialLinks, ...prev }));
    } catch {
      toast({ title: "Erro ao carregar turmas", variant: "destructive" });
    } finally {
      setCarregandoTurmas(false);
    }
  }, [apiBase, toast]);

  const carregarLinksMeta = useCallback(() => {
    fetch(`${apiBase}/api/sync/diario-links-meta`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.links) setLinksMeta(d.links); })
      .catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    carregarTurmas();
    carregarLinksMeta();
  }, [carregarTurmas, carregarLinksMeta]);

  // ── Listener de eventos da extensão Chrome ────────────────────────────────
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
        carregarLinksMeta();
        carregarTurmas();
      } else if (p === "error") {
        toast({ title: "Erro nos diários", description: detail.msg, variant: "destructive" });
        setTimeout(() => setPhase("idle"), 5000);
      }
    };
    window.addEventListener("suap-sync-update", handler);
    return () => window.removeEventListener("suap-sync-update", handler);
  }, [toast, carregarLinksMeta, carregarTurmas]);

  // ── Atualizar link de uma turma no estado local ───────────────────────────
  const setLink = (turmaId: number, value: string) => {
    setLinksPerTurma(prev => ({ ...prev, [turmaId]: value }));
    setLinksDirty(prev => ({ ...prev, [turmaId]: true }));
  };

  // ── Salvar link de uma turma individualmente ──────────────────────────────
  const salvarLinkTurma = async (turmaId: number) => {
    const link = linksPerTurma[turmaId] || "";
    try {
      await fetch(`${apiBase}/api/diario/turmas/${turmaId}/link-suap`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkSuap: link }),
      });
      setLinksDirty(prev => ({ ...prev, [turmaId]: false }));
      carregarLinksMeta();
    } catch {
      // falha silenciosa — será salvo junto com "Salvar todos"
    }
  };

  // ── Salvar todos os links de uma vez ─────────────────────────────────────
  const salvarTodosOsLinks = async () => {
    setSalvandoTodos(true);
    try {
      const entries = turmas
        .filter(t => linksPerTurma[t.id]?.trim())
        .map(t => ({ turmaId: t.id, linkSuap: linksPerTurma[t.id].trim() }));

      const r = await fetch(`${apiBase}/api/diario/turmas/salvar-links-suap`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: entries }),
      });
      const d = await r.json();
      if (d.ok) {
        setLinksDirty({});
        toast({ title: `${d.salvos} links salvos!`, description: "Os links foram associados a cada turma." });
        // Também atualiza o sync/diario-links para retrocompatibilidade
        const linksArr = entries.map(e => e.linkSuap);
        if (linksArr.length > 0) {
          await fetch(`${apiBase}/api/sync/diario-links`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ links: linksArr }),
          });
        }
        carregarLinksMeta();
      } else {
        toast({ title: "Erro ao salvar", description: d.mensagem, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setSalvandoTodos(false);
    }
  };

  // ── Baixar/atualizar um diário individual pelo link ───────────────────────
  const baixarDiario = async (turmaId: number) => {
    const link = linksPerTurma[turmaId]?.trim();
    if (!link) {
      toast({ title: "Cole o link SUAP antes de atualizar", variant: "destructive" });
      return;
    }

    // Salva o link antes de baixar
    if (linksDirty[turmaId]) await salvarLinkTurma(turmaId);

    setBaixandoPorTurma(prev => ({ ...prev, [turmaId]: { phase: "baixando", msg: "" } }));
    try {
      const r = await fetch(`${apiBase}/api/sync/baixar-diario`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setBaixandoPorTurma(prev => ({ ...prev, [turmaId]: { phase: "error", msg: data.mensagem || "Erro ao baixar" } }));
        toast({ title: "Erro ao atualizar diário", description: data.mensagem, variant: "destructive" });
        return;
      }
      setBaixandoPorTurma(prev => ({
        ...prev,
        [turmaId]: { phase: "done", msg: `${data.turma} · ${data.totalAulas} aulas · ${data.totalPresencas} presenças` },
      }));
      carregarLinksMeta();
    } catch (e: any) {
      const msgErr = e.message || "Erro de conexão";
      setBaixandoPorTurma(prev => ({ ...prev, [turmaId]: { phase: "error", msg: msgErr } }));
      toast({ title: "Erro de conexão", description: msgErr, variant: "destructive" });
    }
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const ativo = !["idle", "diarios-done", "error"].includes(phase);
  const naoInstalada = extensaoInstalada === false;

  const manha  = turmas.filter(t => t.turno?.toLowerCase().includes("manh"));
  const tarde  = turmas.filter(t => t.turno?.toLowerCase().includes("tard"));
  const outros = turmas.filter(t => !t.turno?.toLowerCase().includes("manh") && !t.turno?.toLowerCase().includes("tard"));

  // Última sync de um link por turma
  const getUltimaSync = (turmaId: number) => {
    const link = linksPerTurma[turmaId];
    if (!link) return null;
    return linksMeta.find(m => m.link === link)?.ultimaSync ?? null;
  };

  const qtdLinksPreenchidos = turmas.filter(t => linksPerTurma[t.id]?.includes("suap")).length;
  const algumDirty = Object.values(linksDirty).some(Boolean);

  // ── Row por turma ─────────────────────────────────────────────────────────
  const TurmaLinkRow = ({ t }: { t: any }) => {
    const estado = baixandoPorTurma[t.id];
    const fase   = estado?.phase ?? "idle";
    const link   = linksPerTurma[t.id] ?? "";
    const dirty  = linksDirty[t.id] ?? false;
    const ultimaSync = getUltimaSync(t.id);
    const turnoEmoji = t.turno?.toLowerCase().includes("manh") ? "🌅" : t.turno?.toLowerCase().includes("tard") ? "🌇" : "🎓";

    const handleClearLink = async () => {
      setLinksPerTurma(prev => ({ ...prev, [t.id]: "" }));
      try {
        await fetch(`${apiBase}/api/diario/turmas/${t.id}/link-suap`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkSuap: "" }),
        });
        setLinksDirty(prev => ({ ...prev, [t.id]: false }));
        carregarLinksMeta();
        toast({ title: "Link removido", description: `Link da turma ${t.nomeTurma} foi removido.` });
      } catch (err: any) {
        toast({ title: "Erro ao remover link", description: err.message, variant: "destructive" });
      }
    };

    return (
      <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-black/25 border border-white/6 hover:border-white/10 transition-all">
        {/* Lado Esquerdo: info da turma + Botão Sincronizar */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-lg leading-none shrink-0">{turnoEmoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-white truncate">{t.nomeTurma}</p>
                {link ? (
                  <span className="text-[0.55rem] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">Com Link</span>
                ) : (
                  <span className="text-[0.55rem] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium shrink-0">Sem Link</span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 mt-0.5">
                {t.professorResponsavel && (
                  <p className="text-[0.62rem] text-slate-400 truncate">{t.professorResponsavel}</p>
                )}
                {ultimaSync && (
                  <p className="text-[0.58rem] text-slate-500 truncate">
                    • Sync: {new Date(ultimaSync).toLocaleDateString("pt-BR")} {new Date(ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Botão Sincronizar individual */}
          <button
            onClick={() => baixarDiario(t.id)}
            disabled={fase === "baixando" || !link}
            title={!link ? "Configure o link SUAP antes de atualizar" : "Atualizar este diário agora"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[0.68rem] font-black transition-all border shrink-0 ${
              fase === "baixando"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40 cursor-wait"
                : fase === "done"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                : fase === "error"
                ? "bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25"
                : !link
                ? "bg-white/5 text-slate-600 border-white/5 cursor-not-allowed opacity-40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30"
            }`}
          >
            {fase === "baixando" ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Baixando...</>
            ) : fase === "done" ? (
              <><Check className="h-3 w-3" /> Atualizado</>
            ) : fase === "error" ? (
              <><RefreshCcw className="h-3 w-3" /> Tentar</>
            ) : (
              <><RefreshCcw className="h-3 w-3" /> Sincronizar</>
            )}
          </button>
        </div>

        {/* Linha do Input do Link */}
        <div className="flex items-center gap-2">
          <Input
            value={link}
            onChange={(e) => setLink(t.id, e.target.value)}
            placeholder="Cole o link do Diário SUAP (PDF)..."
            className="h-8 text-xs bg-black/40 border-white/10 text-white flex-1"
          />
          {link && (
            <button
              onClick={handleClearLink}
              title="Apagar link"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {dirty && (
            <button
              onClick={() => salvarLinkTurma(t.id)}
              className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shrink-0"
            >
              Salvar
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Seção por turno ───────────────────────────────────────────────────────
  const SecaoTurno = ({ titulo, icon, lista }: { titulo: string; icon: React.ReactNode; lista: any[] }) => {
    if (lista.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          {icon}
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">{titulo}</span>
          <span className="text-[0.6rem] text-slate-600">({lista.length} turmas)</span>
        </div>
        <div className="space-y-2">
          {lista.map(t => <TurmaLinkRow key={t.id} t={t} />)}
        </div>
      </div>
    );
  };

  // ── Barra de progresso (extensão) ─────────────────────────────────────────
  const pct = phase === "idle" ? 0
    : phase === "diarios-opening" ? 5
    : phase === "diarios-login" ? 15
    : phase === "diarios-listing" ? 25
    : phase === "diarios-processing" && progTotal > 0 ? 25 + Math.round((progAtual / progTotal) * 70)
    : phase === "diarios-done" ? 100 : 0;
  const cor = phase === "error" ? "#ef4444" : phase === "diarios-done" ? "#10b981" : "#8b5cf6";

  return (
    <div
      className="bg-[#0f172a] rounded-2xl border p-6 transition-all duration-500"
      style={{ borderColor: ativo ? `${cor}55` : "rgba(255,255,255,0.07)" }}
    >
      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Sincronizar Diários de Classe</h3>
            <span className="text-[0.6rem] font-black uppercase tracking-widest bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">v3.1</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure o link SUAP de cada turma (abrindo o balão individual) para atualizar as presenças.
          </p>
        </div>

        {/* Botões de topo */}
        <div className="flex flex-col items-end gap-2">
          {/* Sincronização automática via servidor */}
          <button
            onClick={syncGlobal.iniciarSincronizacaoGlobal}
            disabled={syncGlobal.fase === "baixando"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              syncGlobal.fase === "baixando"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300 cursor-wait"
                : "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
            )}
          >
            {syncGlobal.fase === "baixando" ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando...</>
            ) : syncGlobal.fase === "done" ? (
              <><Check className="h-3.5 w-3.5" /> Atualizado</>
            ) : (
              <><RefreshCcw className="h-3.5 w-3.5" /> Sincronizar Tudo (Servidor)</>
            )}
          </button>

          {/* Importar via extensão Chrome */}
          <button
            onClick={() => {
              if (!extensaoInstalada || ativo) return;
              const linksManual = turmas
                .filter(t => linksPerTurma[t.id]?.includes("suap"))
                .map(t => linksPerTurma[t.id]);
              if (linksManual.length === 0) {
                toast({ title: "Nenhum link preenchido", description: "Cole os links SUAP das turmas antes de importar via extensão.", variant: "destructive" });
                return;
              }
              window.dispatchEvent(new CustomEvent("suap-sync-diarios-start", { detail: { apiBase, linksManual } }));
              setPhase("diarios-opening");
              setMsg("Iniciando sincronização dos diários...");
              setResultados([]);
              setShowResultados(false);
            }}
            disabled={ativo || naoInstalada}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              naoInstalada
                ? "bg-white/5 text-slate-500 cursor-not-allowed"
                : ativo
                ? "bg-violet-500/20 text-violet-300 cursor-wait"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
          >
            {ativo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            {ativo ? "Importando..." : "Importar (Extensão)"}
          </button>
        </div>
      </div>

      {/* ── Barra de progresso do sync global (servidor) ──────────────────── */}
      {syncGlobal.fase === "baixando" && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-2">
            <span>Sincronização em andamento (Servidor)</span>
            <span>{syncGlobal.progresso.total > 0 ? Math.round((syncGlobal.progresso.atual / syncGlobal.progresso.total) * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/50 overflow-hidden mb-1.5">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${syncGlobal.progresso.total > 0 ? (syncGlobal.progresso.atual / syncGlobal.progresso.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[0.65rem] text-amber-300/80">
            <span>{syncGlobal.progresso.turmaAtual}</span>
            <span>{syncGlobal.progresso.atual} de {syncGlobal.progresso.total}</span>
          </div>
        </div>
      )}

      {/* ── Aviso extensão não instalada ──────────────────────────────────── */}
      {naoInstalada && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Extensão Chrome não detectada. Instale a extensão v3.1.0 para usar o modo "Importar via Extensão".
        </div>
      )}

      {/* ── Carregando turmas ─────────────────────────────────────────────── */}
      {carregandoTurmas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          <span className="ml-2 text-sm text-slate-400">Carregando turmas...</span>
        </div>
      ) : turmas.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-sm">
          Nenhuma turma cadastrada. Cadastre turmas para configurar os links dos diários.
        </div>
      ) : (
        <>
          {/* ── Seções por turno ──────────────────────────────────────────── */}
          <div className="max-h-[520px] overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <SecaoTurno titulo="Turno da Manhã" icon={<Sun className="h-3.5 w-3.5 text-amber-400" />} lista={manha} />
            <SecaoTurno titulo="Turno da Tarde" icon={<Sunset className="h-3.5 w-3.5 text-orange-400" />} lista={tarde} />
            <SecaoTurno titulo="Outros Turnos"  icon={<GraduationCap className="h-3.5 w-3.5 text-violet-400" />} lista={outros} />
          </div>

          {/* ── Rodapé: salvar todos + checkbox ──────────────────────────── */}
          <div className="mt-4 pt-4 border-t border-white/6 flex flex-col gap-3">
            {/* Checkbox salvar todos */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={autoSalvar}
                onChange={e => setAutoSalvar(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-500"
              />
              <div>
                <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors">
                  Salvar todos os links automaticamente
                </span>
                <p className="text-[0.6rem] text-slate-500 mt-0.5">
                  Os links são mantidos salvos até serem trocados. {qtdLinksPreenchidos > 0 && `(${qtdLinksPreenchidos} link${qtdLinksPreenchidos > 1 ? "s" : ""} preenchido${qtdLinksPreenchidos > 1 ? "s" : ""})`}
                </p>
              </div>
            </label>

            {/* Botão Salvar Todos */}
            <button
              onClick={salvarTodosOsLinks}
              disabled={salvandoTodos || qtdLinksPreenchidos === 0}
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all border ${
                salvandoTodos
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30 cursor-wait"
                  : algumDirty || qtdLinksPreenchidos > 0
                  ? "bg-violet-600 text-white border-violet-500 hover:bg-violet-500"
                  : "bg-white/5 text-slate-500 border-white/5 cursor-not-allowed"
              }`}
            >
              {salvandoTodos ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-3.5 w-3.5" /> Salvar todos os links ({qtdLinksPreenchidos} turmas)</>
              )}
            </button>
          </div>
        </>
      )}

      {/* ── Barra de progresso extensão ───────────────────────────────────── */}
      {ativo && (
        <div className="mt-4">
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

      {/* ── Resultados da extensão ────────────────────────────────────────── */}
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
                    ? <span className="text-slate-400">{r.aulasExtraidas || r.aulas} aulas · {r.presencasInseridas || r.presencas} presenças</span>
                    : <span className="text-red-400/70">{r.erro}</span>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Dialog para configurar link de turma individual ── */}
      <Dialog open={!!dialogTurma} onOpenChange={(open) => { if (!open) setDialogTurma(null); }}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-3xl">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-violet-400" />
              Configurar Link SUAP
            </DialogTitle>
            {dialogTurma && (
              <p className="text-xs text-slate-400">
                Defina o link do relatório diário do SUAP para a turma <span className="font-bold text-white">{dialogTurma.nomeTurma}</span>.
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 p-6 space-y-4">
            {dialogTurma && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">
                    Link do Diário no SUAP
                  </Label>
                  <Input
                    value={linksPerTurma[dialogTurma.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLinksPerTurma(prev => ({ ...prev, [dialogTurma.id]: val }));
                      setLinksDirty(prev => ({ ...prev, [dialogTurma.id]: true }));
                    }}
                    placeholder="https://suap.ifrn.edu.br/... ou link correspondente"
                    className="bg-black/40 border-white/10 text-white w-full"
                  />
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                  <p className="font-bold text-slate-400 mb-1">Dica:</p>
                  O link deve apontar para o diário ou relatório correspondente da turma no SUAP para que a sincronização automática de frequências funcione.
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/5 p-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogTurma(null)}
              className="bg-transparent border-white/10 hover:bg-white/5 text-white"
            >
              Fechar
            </Button>
            <Button
              onClick={async () => {
                if (dialogTurma) {
                  await salvarLinkTurma(dialogTurma.id);
                  toast({
                    title: "Link salvo com sucesso!",
                    description: `O link da turma ${dialogTurma.nomeTurma} foi atualizado.`
                  });
                  setDialogTurma(null);
                }
              }}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              Salvar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  const [selectedXlsFile, setSelectedXlsFile] = useState<File | null>(null);
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
  const [limpando, setLimpando] = useState(false);

  // Sync automático de turmas (server-side)
  const [autoTurmasRodando, setAutoTurmasRodando] = useState(false);
  const [autoTurmasPct, setAutoTurmasPct] = useState(0);
  const [autoTurmasMsg, setAutoTurmasMsg] = useState("");
  const [autoTurmasErro, setAutoTurmasErro] = useState<string | null>(null);
  const [autoTurmasConcluido, setAutoTurmasConcluido] = useState(false);
  const [autoTurmasAdicionadas, setAutoTurmasAdicionadas] = useState(0);

  // Upload manual de turmas
  const [uploadTurmas, setUploadTurmas] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [uploadTurmasMsg, setUploadTurmasMsg] = useState("");
  const [uploadTurmasDetalhes, setUploadTurmasDetalhes] = useState<{ adicionadas: number } | null>(null);
  const [dragOverTurmas, setDragOverTurmas] = useState(false);

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


  // Histórico de Sincronização e Logs
  const [historicoList, setHistoricoList] = useState<any[]>([]);
  const [logAberto, setLogAberto] = useState<any | null>(null);

  const carregarHistorico = useCallback(async () => {
    try {
      const data = await apiFetch("/sync/historico");
      setHistoricoList(data);
    } catch (e) {
      console.error("Erro ao carregar histórico:", e);
    }
  }, []);

  // Detectar extensão e carregar histórico + credenciais
  useEffect(() => {
    if (document.documentElement.hasAttribute("data-suap-sync")) {
      setExtensaoInstalada(true);
    } else {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (document.documentElement.hasAttribute("data-suap-sync")) {
          setExtensaoInstalada(true);
          clearInterval(interval);
        } else if (checks >= 6) {
          setExtensaoInstalada(false);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    apiFetch("/sync/status").then(setHistorico).catch(() => {});
    carregarHistorico();
    apiFetch("/sync/credenciais").then((d) => {
      if (d.usuario) setCredUsuario(d.usuario);
      setCredTemSenha(!!d.temSenha);
    }).catch(() => {});
  }, [carregarHistorico]);

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

  const iniciarSyncTurmasAuto = async () => {
    if (autoTurmasRodando) return;
    setAutoTurmasRodando(true);
    setAutoTurmasPct(0);
    setAutoTurmasMsg("Iniciando sincronização automática...");
    setAutoTurmasErro(null);
    setAutoTurmasConcluido(false);
    try {
      const resp = await apiFetch("/sync/auto-turmas", { method: "POST" });
      setAutoTurmasRodando(false);
      if (resp.ok) {
        setAutoTurmasPct(100);
        setAutoTurmasMsg(resp.mensagem || "Sincronização de turmas concluída!");
        setAutoTurmasConcluido(true);
        setAutoTurmasAdicionadas(resp.adicionadas ?? 0);
        toast({ title: "Turmas sincronizadas!", description: resp.mensagem });
        apiFetch("/sync/status").then(setHistorico).catch(() => {});
      } else {
        setAutoTurmasErro(resp.mensagem || "Falha ao sincronizar turmas.");
        toast({ title: "Erro na sincronização de turmas", description: resp.mensagem, variant: "destructive" });
      }
    } catch (e: any) {
      setAutoTurmasRodando(false);
      setAutoTurmasErro(e.message || "Erro ao iniciar sincronização de turmas.");
      toast({ title: "Erro na sincronização de turmas", description: e.message, variant: "destructive" });
    }
  };

  // Polling de turmas automático
  useEffect(() => {
    if (!autoTurmasRodando) return;
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch("/sync/auto-turmas/status");
        setAutoTurmasPct(s.pct ?? 0);
        setAutoTurmasMsg(s.msg ?? "");
        if (!s.rodando) {
          setAutoTurmasRodando(false);
          clearInterval(interval);
          if (s.erro) {
            setAutoTurmasErro(s.erro);
            toast({ title: "Erro na sincronização", description: s.erro, variant: "destructive" });
          } else if (s.concluido) {
            setAutoTurmasConcluido(true);
            setAutoTurmasAdicionadas(s.adicionadas ?? 0);
            toast({ title: "Turmas sincronizadas!", description: s.msg });
            apiFetch("/sync/status").then(setHistorico).catch(() => {});
          }
        }
      } catch (e) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [autoTurmasRodando, toast]);

  const importarTurmasManual = async (file: File) => {
    if (uploadTurmas === "loading") return;
    setUploadTurmas("loading");
    setUploadTurmasMsg("Lendo arquivo...");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const resp = await apiFetch("/sync/upload-turmas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arquivo: base64 }),
        });
        setUploadTurmasDetalhes({
          adicionadas: resp.adicionados ?? resp.adicionadas ?? 0
        });
        setUploadTurmas("ok");
        setUploadTurmasMsg(resp.mensagem || "Turmas importadas com sucesso!");
        toast({ title: "Importação concluída!", description: resp.mensagem });
      } catch (e: any) {
        setUploadTurmas("error");
        setUploadTurmasMsg(e.message || "Erro ao processar o arquivo.");
        toast({ title: "Erro na importação", description: e.message || "Erro desconhecido", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

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
      setAutoRodando(false);
      if (resp.ok) {
        setAutoPct(100);
        setAutoMsg(resp.mensagem || "Sincronização concluída!");
        setAutoConcluido(true);
        toast({ title: "Dados sincronizados!", description: resp.mensagem });
        apiFetch("/sync/status").then(setHistorico).catch(() => {});
      } else {
        setAutoErro(resp.mensagem || "Falha na sincronização.");
        toast({ title: "Erro na sincronização", description: resp.mensagem, variant: "destructive" });
      }
    } catch (e: any) {
      setAutoRodando(false);
      setAutoErro(e.message || "Erro ao iniciar sincronização.");
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    }
  };

  const limparDuplicados = async () => {
    console.log("Iniciando limpeza de duplicados...");
    setLimpando(true);
    try {
      const res = await apiFetch("/sync/limpar-duplicados", { method: "POST" });
      console.log("Limpeza concluída:", res);
      toast({ title: "Limpeza concluída!", description: res.mensagem });
      carregarHistorico();
    } catch (e: any) {
      console.error("Erro na limpeza:", e);
      toast({ title: "Erro na limpeza", description: e.message, variant: "destructive" });
    } finally {
      setLimpando(false);
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
        setSelectedXlsFile(null);
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



  return (
    <div className="space-y-5">





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

      {/* ── Sincronizar Alunos do SUAP ── */}
      <div className="bg-[#0f172a] rounded-2xl border border-cyan-500/20 p-5">
        <h3 className="text-sm font-bold text-cyan-400 mb-1 flex items-center gap-2">
          <Users className="h-4 w-4" /> Sincronizar Alunos do SUAP
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Importe a lista de alunos do SUAP para o sistema. Você pode sincronizar automaticamente (usando o robô) ou fazer upload do arquivo XLS exportado do SUAP.
        </p>

        {/* Sincronização automática via servidor */}
        <div className="mb-4 p-4 rounded-xl border border-white/8 bg-white/3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white/80">Sincronização Direta pelo Servidor (Robô)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">O servidor faz o login no SUAP e atualiza a listagem de todos os alunos.</p>
            </div>
            <Button
              onClick={iniciarSyncAuto}
              disabled={autoRodando}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
            >
              {autoRodando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
              {autoRodando ? "Sincronizando..." : "Sincronizar Alunos"}
            </Button>
          </div>

          {autoRodando && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${autoPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[11px]">
                <span className="text-cyan-400">{autoMsg}</span>
                <span className="text-slate-500">{autoPct}%</span>
              </div>
            </div>
          )}

          {autoConcluido && (
            <div className="text-xs text-emerald-400 font-medium">
              Sincronização de alunos concluída com sucesso!
            </div>
          )}

          {autoErro && (
            <div className="text-xs text-red-400 font-medium">
              Erro na sincronização: {autoErro}
            </div>
          )}
        </div>

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
              Atualizar toda a lista de alunos (para upload manual)
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
            if (file) setSelectedXlsFile(file);
          }}
          onClick={() => {
            if (!selectedXlsFile) document.getElementById("xls-upload-input")?.click();
          }}
        >
          <input
            id="xls-upload-input"
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) setSelectedXlsFile(file);
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
          ) : selectedXlsFile ? (
            <div className="flex flex-col items-center gap-2 text-cyan-400" onClick={e => e.stopPropagation()}>
              <FileSpreadsheet className="h-8 w-8 mb-1" />
              <span className="text-sm font-bold text-white truncate max-w-xs">{selectedXlsFile.name}</span>
              <span className="text-xs text-slate-400">({(selectedXlsFile.size / 1024).toFixed(1)} KB)</span>
              <button
                className="mt-2 text-xs text-red-400 underline underline-offset-2 hover:text-red-300"
                onClick={() => setSelectedXlsFile(null)}
              >
                Remover arquivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="h-8 w-8 mb-1" />
              <span className="text-sm font-medium text-slate-300">Arraste o arquivo XLS aqui</span>
              <span className="text-xs">ou clique para selecionar</span>
            </div>
          )}
        </div>

        {uploadManual === "idle" && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                if (selectedXlsFile) processarArquivoXLS(selectedXlsFile);
              }}
              disabled={!selectedXlsFile}
              className={cn(
                "px-6 py-2.5 font-bold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all",
                selectedXlsFile
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/25 hover:scale-[1.02]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
              )}
            >
              Atualizar Alunos
            </Button>
          </div>
        )}
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
          BLOCO: Sincronizar Turmas do SUAP
      ═══════════════════════════════════════════ */}
      <div className="bg-[#0f172a] rounded-2xl border border-blue-500/20 p-5">
        <h3 className="text-sm font-bold text-blue-400 mb-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Sincronizar Turmas do SUAP
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Importe as siglas das turmas do SUAP para o sistema. Você pode sincronizar automaticamente (usando o robô) ou fazer upload do arquivo XLS exportado do SUAP.
        </p>

        {/* Sync automático de turmas */}
        <div className="mb-4 p-4 rounded-xl border border-white/8 bg-white/3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white/80">Sincronização Direta pelo Servidor (Robô)</p>
              <p className="text-[11px] text-slate-500 mt-0.5">O servidor faz o login no SUAP e extrai as turmas do ano letivo atual.</p>
            </div>
            <Button
              onClick={iniciarSyncTurmasAuto}
              disabled={autoTurmasRodando}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              {autoTurmasRodando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1" />}
              {autoTurmasRodando ? "Sincronizando..." : "Sincronizar Turmas"}
            </Button>
          </div>

          {autoTurmasRodando && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${autoTurmasPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[11px]">
                <span className="text-blue-400">{autoTurmasMsg}</span>
                <span className="text-slate-500">{autoTurmasPct}%</span>
              </div>
            </div>
          )}

          {autoTurmasConcluido && (
            <div className="text-xs text-emerald-400 font-medium">
              Sincronização de turmas concluída com sucesso! {autoTurmasAdicionadas} novas turmas adicionadas.
            </div>
          )}

          {autoTurmasErro && (
            <div className="text-xs text-red-400 font-medium">
              Erro na sincronização: {autoTurmasErro}
            </div>
          )}
        </div>

        {/* Upload manual de turmas */}
        <div
          className="relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOverTurmas ? "#3b82f6" : "rgba(255,255,255,0.1)",
            background: dragOverTurmas ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.02)",
          }}
          onDragOver={e => { e.preventDefault(); setDragOverTurmas(true); }}
          onDragLeave={() => setDragOverTurmas(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOverTurmas(false);
            const file = e.dataTransfer.files[0];
            if (file) importarTurmasManual(file);
          }}
          onClick={() => {
            if (uploadTurmas !== "loading") {
              const inp = document.createElement("input");
              inp.type = "file";
              inp.accept = ".xls,.xlsx";
              inp.onchange = (e: any) => {
                const file = e.target.files?.[0];
                if (file) importarTurmasManual(file);
              };
              inp.click();
            }
          }}
        >
          {uploadTurmas === "loading" ? (
            <div className="flex flex-col items-center gap-2 text-blue-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-medium">{uploadTurmasMsg}</span>
            </div>
          ) : uploadTurmas === "ok" ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                <Check className="h-5 w-5" /> {uploadTurmasMsg}
              </div>
              {uploadTurmasDetalhes && (
                <div className="text-[11px] text-slate-400">
                  {uploadTurmasDetalhes.adicionadas} novas turmas adicionadas no banco de dados.
                </div>
              )}
              <button
                className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-300 mt-1"
                onClick={e => { e.stopPropagation(); setUploadTurmas("idle"); setUploadTurmasMsg(""); setUploadTurmasDetalhes(null); }}
              >Importar outro arquivo</button>
            </div>
          ) : uploadTurmas === "error" ? (
            <div className="flex flex-col items-center gap-2 text-red-400">
              <AlertTriangle className="h-8 w-8" />
              <span className="text-sm font-semibold">{uploadTurmasMsg}</span>
              <button
                className="mt-1 text-xs text-slate-400 underline underline-offset-2"
                onClick={e => { e.stopPropagation(); setUploadTurmas("idle"); setUploadTurmasMsg(""); }}
              >Tentar novamente</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Upload className="h-8 w-8 mb-1" />
              <span className="text-sm font-medium text-slate-300">Arraste o arquivo XLS de turmas aqui</span>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Histórico de Sincronização</h3>
          <button 
            onClick={carregarHistorico}
            className="text-[0.65rem] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <RefreshCcw className="h-3 w-3" /> Atualizar Lista
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 border-b border-white/5">Data/Hora</th>
                <th className="px-4 py-3 border-b border-white/5">Status</th>
                <th className="px-4 py-3 border-b border-white/5">Resumo</th>
                <th className="px-4 py-3 border-b border-white/5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historicoList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">
                    Nenhuma sincronização registrada.
                  </td>
                </tr>
              ) : (
                historicoList.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-medium">
                      {new Date(h.ultimaSync).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-tighter",
                        h.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                        h.status === "error" ? "bg-red-500/10 text-red-400" :
                        "bg-slate-500/10 text-slate-400"
                      )}>
                        {h.status === "success" ? "Sucesso" : h.status === "error" ? "Erro" : h.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[300px] truncate">
                      {h.mensagem}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {h.detalhes ? (
                        <button
                          onClick={() => {
                            try {
                              setLogAberto({ ...h, detalhes: JSON.parse(h.detalhes) });
                            } catch {
                              toast({ title: "Erro ao abrir log", variant: "destructive" });
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 font-bold transition-all"
                        >
                          Ver Log
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[0.65rem] font-bold">Sem Detalhes</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Log */}
      <Dialog open={!!logAberto} onOpenChange={() => setLogAberto(null)}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
              Relatório de Sincronização
            </DialogTitle>
            <p className="text-xs text-slate-400">
              Sincronização realizada em {logAberto && new Date(logAberto.ultimaSync).toLocaleString("pt-BR")}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-4">
            {logAberto?.detalhes && (
              <>
                {/* Novos */}
                {logAberto.detalhes.adicionados?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                      <Plus className="h-3 w-3" /> Novos Alunos ({logAberto.detalhes.adicionados.length})
                    </h4>
                    <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 grid grid-cols-2 gap-x-4 gap-y-1">
                      {logAberto.detalhes.adicionados.map((nome: string, i: number) => (
                        <div key={i} className="text-[11px] text-emerald-100/70 truncate">• {nome}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Atualizados */}
                {logAberto.detalhes.atualizados?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                      <RefreshCcw className="h-3 w-3" /> Dados Atualizados ({logAberto.detalhes.atualizados.length})
                    </h4>
                    <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 grid grid-cols-2 gap-x-4 gap-y-1">
                      {logAberto.detalhes.atualizados.map((nome: string, i: number) => (
                        <div key={i} className="text-[11px] text-blue-100/70 truncate">• {nome}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transferidos */}
                {logAberto.detalhes.transferidos?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <Trash2 className="h-3 w-3" /> Saídas/Transferidos ({logAberto.detalhes.transferidos.length})
                    </h4>
                    <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 grid grid-cols-2 gap-x-4 gap-y-1">
                      {logAberto.detalhes.transferidos.map((nome: string, i: number) => (
                        <div key={i} className="text-[11px] text-amber-100/70 truncate">• {nome}</div>
                      ))}
                    </div>
                  </div>
                )}

                {(!logAberto.detalhes.adicionados?.length && !logAberto.detalhes.atualizados?.length && !logAberto.detalhes.transferidos?.length) && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Nenhuma alteração de nomes detectada nesta sincronização.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between items-center pt-4 border-t border-white/5">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (logAberto) {
                    const html = obterHtmlLogSinc(logAberto);
                    imprimirLogOnline("RICOH", "Relatório de Sincronização", html, toast);
                  }
                }}
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Ricoh (Online)
              </Button>
              <Button
                onClick={() => {
                  if (logAberto) {
                    const html = obterHtmlLogSinc(logAberto);
                    imprimirLogOnline("EPSON", "Relatório de Sincronização", html, toast);
                  }
                }}
                className="bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/20 text-xs font-bold"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" /> Epson (Online)
              </Button>
              <Button
                onClick={() => {
                  if (logAberto) {
                    const html = obterHtmlLogSinc(logAberto);
                    imprimirLogLocal("Relatório de Sincronização", html, toast);
                  }
                }}
                className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-bold"
              >
                <Wifi className="h-3.5 w-3.5 mr-1.5" /> Imprimir (Rede Local)
              </Button>
            </div>
            <Button onClick={() => setLogAberto(null)} className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold">
              Fechar Relatório
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════
   SEÇÃO: Cores das Turmas — com color wheel
══════════════════════════════════════════ */
interface TurmaComCor {
  id: number;
  nome_turma?: string;
  nomeTurma?: string;
  turno: string | null;
  cor: string;
  professor_responsavel?: string | null;
  professorResponsavel?: string | null;
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
              className="flex flex-col items-center p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group overflow-hidden"
            >
              <div
                className="w-full h-20 rounded-2xl border-2 border-white/20 shadow-lg transition-transform group-hover:scale-[1.02] flex flex-col items-center justify-center p-2"
                style={{ background: cor, boxShadow: `0 6px 16px ${cor}55` }}
              >
                <span className="text-xs font-black text-white text-center drop-shadow-md">{turma.nome_turma || turma.nomeTurma || "SEM NOME"}</span>
                <span className="text-[0.6rem] text-white/80 font-bold drop-shadow-md">{turma.turno ?? ""}</span>
                {(turma.professor_responsavel || turma.professorResponsavel) && (
                  <span className="text-[0.55rem] text-white/70 text-center drop-shadow-md truncate w-full mt-0.5" title={(turma.professor_responsavel || turma.professorResponsavel)!}>
                    {(turma.professor_responsavel || turma.professorResponsavel)!.split(" ")[0]}
                  </span>
                )}
              </div>
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
interface TurmaOpcao { id: number; nome_turma?: string; nomeTurma?: string; turno: string | null; }

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
      .then((d) => {
        if (d && Array.isArray(d.rows)) {
          setTurmas(d.rows);
        } else {
          apiFetch("/turmas?all=true")
            .then((res) => {
              if (Array.isArray(res)) setTurmas(res);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        apiFetch("/turmas?all=true")
          .then((res) => {
            if (Array.isArray(res)) setTurmas(res);
          })
          .catch(() => {});
      });
  }, []);

  // Exibe todas as turmas em ambos os turnos para evitar exclusão de turmas com turnos cadastrados de forma inconsistente no banco de dados.
  const turmasManha = turmas;
  const turmasTarde = turmas;

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
                    <option key={t.id} value={t.nome_turma || t.nomeTurma} className="bg-[#1e293b] text-white">
                      {t.nome_turma || t.nomeTurma}
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
                    <option key={t.id} value={t.nome_turma || t.nomeTurma} className="bg-[#1e293b] text-white">
                      {t.nome_turma || t.nomeTurma}
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
    apiFetch("/professores")
      .then((d) => {
        if (Array.isArray(d)) {
          setProfessores(d);
        } else if (d && Array.isArray(d.rows)) {
          setProfessores(d.rows);
        } else {
          apiFetch("/admin/professores?limit=200")
            .then((ad) => setProfessores(ad.rows || []))
            .catch(() => {});
        }
      })
      .catch(() => {
        apiFetch("/admin/professores?limit=200")
          .then((ad) => setProfessores(ad.rows || []))
          .catch(() => {});
      });
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
                        ) : col === "qtd_alunos" ? (
                          <span className="font-bold text-slate-300 font-mono bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-xs">
                            {row[col] ?? 0}
                          </span>
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
   SEÇÃO: E-mail, WhatsApp e IPs (Contatos)
══════════════════════════════════════════ */
function SecaoContatos() {
  const [form, setForm] = useState({
    escola_email: "",
    escola_telefone: "",
    impressora_ricoh_ip: "",
    impressora_epson_ip: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: "465",
    smtp_user: "",
    smtp_pass: "",
    smtp_secure: true
  });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  async function carregar() {
    try {
      const r = await apiFetch("/escola/contatos");
      setForm({
        escola_email: r.escola_email || "",
        escola_telefone: r.escola_telefone || "",
        impressora_ricoh_ip: r.impressora_ricoh_ip || "",
        impressora_epson_ip: r.impressora_epson_ip || "",
        smtp_host: r.smtp_host || "smtp.gmail.com",
        smtp_port: r.smtp_port || "465",
        smtp_user: r.smtp_user || r.escola_email || "",
        smtp_pass: r.smtp_pass || "",
        smtp_secure: r.smtp_secure !== undefined ? (r.smtp_secure === "true" || r.smtp_secure === true) : true
      });
    } catch (err: any) {
      toast({ title: "Erro ao carregar configurações", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setSalvando(true);
    try {
      await apiFetch("/escola/contatos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      toast({ title: "Configurações salvas!", description: "Os contatos e configurações SMTP foram atualizados." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-7 w-7 text-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/[0.07] space-y-4">
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-orange-400" />
          Contatos e IPs de Referência
        </h3>
        <p className="text-white/40 text-xs">
          Essas informações são usadas como referencial para o envio de e-mails, WhatsApp e ping das impressoras.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">E-mail da Escola</Label>
            <Input
              value={form.escola_email}
              onChange={e => setForm(f => ({ ...f, escola_email: e.target.value }))}
              placeholder="escola@dominio.com"
              className="bg-background/50 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Telefone/WhatsApp da Escola</Label>
            <Input
              value={form.escola_telefone}
              onChange={e => setForm(f => ({ ...f, escola_telefone: e.target.value }))}
              placeholder="(22) 99813-1096"
              className="bg-background/50 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">IP da Impressora RICOH</Label>
            <Input
              value={form.impressora_ricoh_ip}
              onChange={e => setForm(f => ({ ...f, impressora_ricoh_ip: e.target.value }))}
              placeholder="Ex: 192.168.1.100"
              className="bg-background/50 border-white/10 text-white font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">IP da Impressora EPSON</Label>
            <Input
              value={form.impressora_epson_ip}
              onChange={e => setForm(f => ({ ...f, impressora_epson_ip: e.target.value }))}
              placeholder="Ex: 192.168.1.101"
              className="bg-background/50 border-white/10 text-white font-mono"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/[0.07] space-y-4">
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <Mail className="h-5 w-5 text-orange-400" />
          Configurações de E-mail (Servidor SMTP)
        </h3>
        <p className="text-white/40 text-xs">
          Configure as credenciais SMTP do e-mail da escola para enviar documentos em PDF por e-mail diretamente do sistema.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Servidor SMTP (Host)</Label>
            <Input
              value={form.smtp_host}
              onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="bg-background/50 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Porta SMTP</Label>
            <Input
              value={form.smtp_port}
              onChange={e => setForm(f => ({ ...f, smtp_port: e.target.value }))}
              placeholder="465 ou 587"
              className="bg-background/50 border-white/10 text-white font-mono"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Usuário SMTP / Login</Label>
            <Input
              value={form.smtp_user}
              onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))}
              placeholder="escola@dominio.com"
              className="bg-background/50 border-white/10 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs uppercase tracking-wider">Senha / Senha de App</Label>
            <Input
              type="password"
              value={form.smtp_pass}
              onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))}
              placeholder="••••••••••••"
              className="bg-background/50 border-white/10 text-white"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-3 py-1">
            <input
              type="checkbox"
              id="smtp_secure"
              checked={form.smtp_secure}
              onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked }))}
              className="rounded border-white/10 bg-background/50 text-orange-500 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <Label htmlFor="smtp_secure" className="text-white/70 text-xs cursor-pointer select-none">
              Utilizar conexão segura SSL/TLS (Recomendado para porta 465)
            </Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={salvar} disabled={salvando} className="bg-orange-500 hover:bg-orange-600 gap-2 text-white px-6 font-semibold">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Ajustes
        </Button>
      </div>
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

/* ══════════════════════════════════════════
   SEÇÃO: WhatsApp
══════════════════════════════════════════ */
function SecaoWhatsAppConexao() {
  const [status, setStatus] = useState<{ ready: boolean; code: string | null; number: string | null; guiMode?: boolean } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [inputNumber, setInputNumber] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        const res = await fetch(API(`/whatsapp/status?t=${Date.now()}`), { cache: "no-store" });
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error("Erro ao checar whatsapp:", err);
      } finally {
        setCarregando(false);
      }
      timeout = setTimeout(check, 3000);
    }
    check();
    return () => clearTimeout(timeout);
  }, []);

  const handleToggleGuiMode = async (enabled: boolean) => {
    try {
      const res = await fetch(API("/whatsapp/gui-mode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        setStatus(prev => prev ? { ...prev, guiMode: enabled } : null);
        toast({
          title: "Modo alterado!",
          description: enabled 
            ? "Sistema configurado para envio via Automação do WhatsApp Desktop local." 
            : "Sistema configurado para envio via pareamento de código (Baileys)."
        });
      } else {
        toast({ title: "Erro ao alterar modo", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch(API("/whatsapp/disconnect"), { method: "POST" });
      toast({ title: "Comando enviado!", description: "O robô local será desconectado e um QR Code será gerado em instantes." });
    } catch (e) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!inputNumber || inputNumber.length < 10) {
      toast({ title: "Número Inválido", description: "Digite um número de WhatsApp válido com DDD.", variant: "destructive" });
      return;
    }
    try {
      await fetch(API("/whatsapp/generate"), { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: inputNumber }) 
      });
      toast({ title: "Comando enviado!", description: "Gerando código de pareamento na nuvem..." });
      setStatus({ ...status, code: null, ready: false, number: inputNumber });
    } catch (e) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  if (carregando) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="max-w-md space-y-6">
      <div className="bg-[#1a2332] rounded-3xl p-6 border border-white/5 text-center relative overflow-hidden">
        {status?.ready && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#22c55e]/10 to-transparent pointer-events-none" />
        )}
        
        <MessageCircle className={`w-12 h-12 mx-auto mb-4 ${status?.ready ? 'text-[#22c55e]' : 'text-slate-500'}`} />
        <h3 className="text-xl font-bold text-white mb-2">Bot do WhatsApp</h3>
        <p className="text-sm text-white/50 mb-6 relative z-10">
          Sincronize o número da escola para habilitar mensagens automáticas.
        </p>

        {status?.ready ? (
          <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-2xl p-6 relative z-10 shadow-lg shadow-[#22c55e]/5">
            <ShieldCheck className="w-10 h-10 text-[#22c55e] mx-auto mb-3 drop-shadow-md" />
            <p className="text-white font-black text-lg tracking-wide">Conectado!</p>
            <p className="text-sm text-[#22c55e] font-semibold mt-1 bg-[#22c55e]/10 py-1.5 px-3 rounded-full inline-block">
              +{status.number || "Número Sincronizado"}
            </p>
            
            <div className="mt-6 pt-4 border-t border-[#22c55e]/20">
              <button 
                onClick={handleDisconnect}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-500/20 hover:border-red-500/40"
              >
                <WifiOff className="w-4 h-4" /> Desconectar / Trocar Número
              </button>
            </div>
          </div>
        ) : status?.code ? (
          <div className="flex flex-col gap-4 relative z-10">
            <div className="bg-slate-800 p-6 rounded-2xl inline-block mx-auto shadow-xl shadow-black/40 border border-slate-600">
              <p className="text-sm text-white/70 mb-3">Seu Código de Pareamento:</p>
              <div className="bg-slate-900 text-white text-3xl font-mono tracking-[0.25em] py-4 px-6 rounded-xl border-2 border-slate-700 select-all">
                {status.code}
              </div>
              <p className="text-xs text-white/50 font-medium mt-4 max-w-[240px] mx-auto leading-relaxed">
                Abra o WhatsApp no celular, vá em <strong className="text-white">Aparelhos Conectados</strong> {'>'} <strong className="text-white">Conectar com Número de Telefone</strong> e digite o código acima.
              </p>
            </div>
            <button 
              onClick={handleDisconnect}
              className="mx-auto flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-xl text-sm font-bold transition-all border border-slate-500"
            >
              <RefreshCcw className="w-4 h-4" /> Cancelar / Trocar Número
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 relative z-10">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <label className="block text-left text-sm font-medium text-white/80 mb-2">
                Número do WhatsApp (com DDD)
              </label>
              <input 
                type="text" 
                placeholder="Ex: 22981310965"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-black/40 text-white placeholder-white/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all font-mono text-lg"
              />
            </div>
            <button 
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white py-3 px-6 rounded-xl font-bold transition-all shadow-lg shadow-[#22c55e]/20"
            >
              Gerar Código de Conexão
            </button>
          </div>
        )}
      </div>

      {/* Card de Configuração do Modo de Envio */}
      <div className="bg-[#1a2332] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
        <h4 className="text-white font-bold text-base mb-2 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[#22c55e]" /> Modo de Envio das Mensagens
        </h4>
        <p className="text-xs text-white/50 mb-4">
          Escolha como o sistema deve disparar as mensagens do WhatsApp (Fila de Envio).
        </p>

        <div className="space-y-3">
          <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${!status?.guiMode ? 'bg-[#22c55e]/10 border-[#22c55e]/40 shadow-md shadow-[#22c55e]/5' : 'bg-transparent border-white/5 hover:bg-white/5'}`}>
            <input 
              type="radio" 
              name="guiMode" 
              checked={!status?.guiMode}
              onChange={() => handleToggleGuiMode(false)}
              className="mt-1 accent-[#22c55e]"
            />
            <div className="text-left">
              <span className="text-sm font-bold text-white block">Modo Robô (Headless/Baileys)</span>
              <span className="text-xs text-white/40 block mt-0.5">
                Executa em segundo plano via código. Ideal se a conexão Baileys estiver pareada e estável.
              </span>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${status?.guiMode ? 'bg-[#22c55e]/10 border-[#22c55e]/40 shadow-md shadow-[#22c55e]/5' : 'bg-transparent border-white/5 hover:bg-white/5'}`}>
            <input 
              type="radio" 
              name="guiMode" 
              checked={status?.guiMode || false}
              onChange={() => handleToggleGuiMode(true)}
              className="mt-1 accent-[#22c55e]"
            />
            <div className="text-left">
              <span className="text-sm font-bold text-white block">Modo Aplicativo (Automação GUI)</span>
              <span className="text-xs text-white/40 block mt-0.5">
                Controla o aplicativo WhatsApp Desktop do computador local, abrindo janelas e colando os arquivos automaticamente.
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

function SecaoWhatsAppAutomacoes() {
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [executandoId, setExecutandoId] = useState<number | null>(null);

  const [professores, setProfessores] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);

  const [turmaSelecionadaParaAluno, setTurmaSelecionadaParaAluno] = useState("");
  const [alunosDaTurma, setAlunosDaTurma] = useState<any[]>([]);

  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({
    nome: "",
    tipoDocumento: "mensagem",
    mensagem: "",
    arquivoBase64: "",
    nomeArquivo: "",
    mimetype: "",
    frequencia: "unico",
    diasSemana: [],
    diaMes: "",
    horario: "08:00",
    destinatarioTipo: "numero",
    destinatarioValor: "",
    documentoEscopo: "todas",
    documentoAlvo: "",
    documentoMes: "atual",
    diasMes: ""
  });

  useEffect(() => {
    if (turmaSelecionadaParaAluno) {
      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      fetch(`${BASE}api/alunos?turma=${encodeURIComponent(turmaSelecionadaParaAluno)}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => setAlunosDaTurma(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      setAlunosDaTurma([]);
    }
  }, [turmaSelecionadaParaAluno]);

  const { toast } = useToast();

  const carregarDados = useCallback(async () => {
    try {
      const res = await fetch(API("/automatizacoes"));
      const data = await res.json();
      setLista(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  const [escolaGrupoJid, setEscolaGrupoJid] = useState("");

  const carregarListas = useCallback(async () => {
    try {
      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const [resProfs, resGroups, resTurmas, resEscola] = await Promise.all([
        fetch(API("/professores")),
        fetch(API("/whatsapp/groups")),
        fetch(API("/turmas?all=true")),
        fetch(`${BASE}api/escola/contatos`)
      ]);
      setProfessores(await resProfs.json());
      setGrupos(await resGroups.json());
      setTurmas(await resTurmas.json());
      
      const escolaData = await resEscola.json();
      if (escolaData && escolaData.escola_whatsapp_grupo) {
        setEscolaGrupoJid(escolaData.escola_whatsapp_grupo);
      }
    } catch (err) {
      console.error("Erro ao carregar listas:", err);
    }
  }, []);

  useEffect(() => {
    carregarDados();
    carregarListas();
  }, [carregarDados, carregarListas]);

  const handleToggle = async (id: number) => {
    try {
      const res = await fetch(API(`/automatizacoes/${id}/toggle`), { method: "PATCH" });
      const data = await res.json();
      setLista(lista.map(a => a.id === id ? { ...a, ativa: data.ativa } : a));
      toast({ title: data.ativa ? "Agendamento Ativado" : "Agendamento Pausado" });
    } catch (e) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza de que deseja excluir este agendamento?")) return;
    try {
      await fetch(API(`/automatizacoes/${id}`), { method: "DELETE" });
      setLista(lista.filter(a => a.id !== id));
      toast({ title: "Agendamento removido" });
    } catch (e) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  const handleExecutarAgora = async (id: number) => {
    setExecutandoId(id);
    try {
      const res = await fetch(API(`/automatizacoes/${id}/executar-agora`), { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Enviado com sucesso!", description: `${data.mensagensEnfileiradas} mensagens adicionadas à fila de envio.` });
        carregarDados();
      } else {
        toast({ title: "Falha ao executar", description: data.erro, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Erro de rede", variant: "destructive" });
    } finally {
      setExecutandoId(null);
    }
  };

  const abrirNovo = () => {
    setEditId(null);
    setForm({
      nome: "",
      tipoDocumento: "mensagem",
      mensagem: "",
      arquivoBase64: "",
      nomeArquivo: "",
      mimetype: "",
      frequencia: "unico",
      diasSemana: [],
      diaMes: "",
      horario: "08:00",
      destinatarioTipo: "numero",
      destinatarioValor: "",
      documentoEscopo: "todas",
      documentoAlvo: "",
      documentoMes: "atual",
      diasMes: ""
    });
    setTurmaSelecionadaParaAluno("");
    setWizardStep(1);
    setDialogAberto(true);
  };

  const abrirEditar = async (auto: any) => {
    setEditId(auto.id);
    setForm({
      nome: auto.nome,
      tipoDocumento: auto.tipoDocumento,
      mensagem: auto.mensagem || "",
      arquivoBase64: auto.arquivoBase64 || "",
      nomeArquivo: auto.nomeArquivo || "",
      mimetype: auto.mimetype || "",
      frequencia: auto.frequencia,
      diasSemana: auto.diasSemana ? auto.diasSemana.split(",").map(Number) : [],
      diaMes: auto.diaMes || "",
      horario: auto.horario,
      destinatarioTipo: auto.destinatarioTipo,
      destinatarioValor: auto.destinatarioValor || "",
      documentoEscopo: auto.documentoEscopo || "todas",
      documentoAlvo: auto.documentoAlvo || "",
      documentoMes: auto.documentoMes || "atual",
      diasMes: auto.diasMes || ""
    });

    if (auto.documentoEscopo === "aluno" && auto.documentoAlvo) {
      try {
        const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
        const res = await fetch(`${BASE}api/alunos/${auto.documentoAlvo}`, { credentials: "include" });
        const aluno = await res.json();
        if (aluno && aluno.turmaAtual) {
          setTurmaSelecionadaParaAluno(aluno.turmaAtual);
        }
      } catch (err) {
        console.error("Erro ao carregar aluno para edicao:", err);
      }
    } else {
      setTurmaSelecionadaParaAluno("");
    }

    setWizardStep(1);
    setDialogAberto(true);
  };

  const handleSalvar = async (adicionarOutra: boolean = false) => {
    if (!form.nome) {
      toast({ title: "Preencha o nome do agendamento", variant: "destructive" });
      return;
    }
    if (form.frequencia === "semanal" && form.diasSemana.length === 0) {
      toast({ title: "Selecione ao menos um dia da semana", variant: "destructive" });
      return;
    }
    if (form.frequencia === "mensal" && !form.diaMes && !form.diasMes) {
      toast({ title: "Selecione ao menos um dia do mês", variant: "destructive" });
      return;
    }
    if (!form.destinatarioValor && ["numero", "professor", "grupo", "turma_alunos"].includes(form.destinatarioTipo)) {
      toast({ title: "Selecione ou preencha o destinatário", variant: "destructive" });
      return;
    }

    const primeiroDia = form.diasMes ? parseInt(form.diasMes.split(",")[0]) : null;
    const body = {
      ...form,
      diasSemana: form.diasSemana.length > 0 ? form.diasSemana.join(",") : null,
      diaMes: form.diaMes ? parseInt(form.diaMes) : primeiroDia,
      diasMes: form.diasMes || null,
    };

    try {
      const url = editId ? API(`/automatizacoes/${editId}`) : API("/automatizacoes");
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Erro");

      toast({ title: editId ? "Agendamento atualizado!" : "Agendamento salvo!" });
      carregarDados();

      if (adicionarOutra && !editId) {
        setForm({
          nome: "",
          tipoDocumento: "mensagem",
          mensagem: "",
          arquivoBase64: "",
          nomeArquivo: "",
          mimetype: "",
          frequencia: "unico",
          diasSemana: [],
          diaMes: "",
          horario: "08:00",
          destinatarioTipo: "numero",
          destinatarioValor: "",
          documentoEscopo: "todas",
          documentoAlvo: "",
          documentoMes: "atual",
          diasMes: ""
        });
        setTurmaSelecionadaParaAluno("");
        setWizardStep(1);
      } else {
        setDialogAberto(false);
      }
    } catch (e) {
      toast({ title: "Erro ao salvar agendamento", variant: "destructive" });
    }
  };

  const traduzirFrequencia = (freq: string, dias: string, diaMes: number, hora: string, diasMesStr?: string) => {
    const formatHora = `às ${hora}`;
    if (freq === "imediato") return "Imediatamente";
    if (freq === "unico") return `Única vez ${formatHora}`;
    if (freq === "diario") return `Diariamente ${formatHora}`;
    if (freq === "semanal" && dias) {
      const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const diasArr = dias.split(",").map(Number);
      const nomesDias = diasArr.map(d => nomes[d]).join(", ");
      return `Semanal (${nomesDias}) ${formatHora}`;
    }
    if (freq === "mensal") {
      if (diasMesStr) return `Mensal (Dias ${diasMesStr}) ${formatHora}`;
      if (diaMes) return `Mensal (Dia ${diaMes}) ${formatHora}`;
    }
    return freq;
  };

  const traduzirDestinatario = (tipo: string, valor: string) => {
    if (tipo === "numero") return `Número: ${valor}`;
    if (tipo === "professor") {
      const p = professores.find(prof => prof.id.toString() === valor);
      return `Prof: ${p ? p.nome : valor}`;
    }
    if (tipo === "todos_professores") return "Todos os Professores";
    if (tipo === "grupo") {
      if (valor === "grupo_da_escola" || valor === escolaGrupoJid) return "Grupo da Escola (Oficial)";
      const g = grupos.find(gp => gp.jid === valor);
      return `Grupo: ${g ? g.nome : "Selecionado"}`;
    }
    if (tipo === "turma_alunos") return `Alunos da Turma: ${valor}`;
    if (tipo === "todos_alunos") return "Todos os Alunos";
    if (tipo === "funcionarios") return "Equipe de Funcionários";
    return tipo;
  };

  const traduzirDocumento = (tipo: string) => {
    if (tipo === "mensagem") return "Mensagem de Texto";
    if (tipo === "ficai") return "FICAI";
    if (tipo === "freq_mensal") return "Frequência Mensal";
    if (tipo === "resumo_turma") return "Resumo de Turma";
    if (tipo === "pre_diario") return "Pré-diário";
    return tipo;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#1a2332] p-6 rounded-3xl border border-white/5">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Agendamentos do WhatsApp</h3>
          <p className="text-sm text-white/50">Crie regras e relatórios para envio periódico automático.</p>
        </div>
        <Button 
          onClick={abrirNovo}
          className="bg-[#22c55e] hover:bg-[#16a34a] text-white flex items-center gap-2 rounded-xl py-2.5 px-4 font-bold transition-all shadow-lg shadow-[#22c55e]/20"
        >
          <Plus className="w-4 h-4" /> Novo Agendamento
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : lista.length === 0 ? (
        <div className="bg-[#1a2332]/50 rounded-3xl border border-white/5 p-12 text-center text-white/40">
          Nenhum envio agendado ainda. Clique em "Novo Agendamento" para programar um disparo!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lista.map((auto) => (
            <div 
              key={auto.id} 
              className={`bg-[#1a2332] rounded-2xl p-5 border border-white/5 transition-all hover:border-white/10 relative overflow-hidden flex flex-col justify-between ${!auto.ativa ? "opacity-60" : ""}`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-white font-bold text-base leading-tight mb-1">{auto.nome}</h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-full inline-block">
                      {traduzirDocumento(auto.tipoDocumento)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleToggle(auto.id)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all ${auto.ativa ? "bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30" : "bg-white/5 text-white/40 border border-white/10"}`}
                  >
                    {auto.ativa ? "Ativo" : "Pausado"}
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-white/70">
                  <p className="flex items-center gap-2">
                    <span className="text-white/40 font-medium w-20">Frequência:</span>
                    <span className="font-semibold text-white">{traduzirFrequencia(auto.frequencia, auto.diasSemana, auto.diaMes, auto.horario, auto.diasMes)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-white/40 font-medium w-20">Enviar para:</span>
                    <span className="font-semibold text-white truncate max-w-[200px]">{traduzirDestinatario(auto.destinatarioTipo, auto.destinatarioValor)}</span>
                  </p>
                  {auto.nomeArquivo && (
                    <p className="flex items-center gap-2 text-sky-400">
                      <span className="text-white/40 font-medium w-20">Arquivo:</span>
                      <span className="font-bold truncate max-w-[200px]">{auto.nomeArquivo}</span>
                    </p>
                  )}
                </div>

                {auto.ativa && (
                  <div className="pt-2.5 border-t border-white/5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40 font-mono">
                    {auto.ultimaExecucao && (
                      <p>Último: {new Date(auto.ultimaExecucao).toLocaleString("pt-BR")}</p>
                    )}
                    {auto.proximaExecucao && (
                      <p>Próximo: {new Date(auto.proximaExecucao).toLocaleString("pt-BR")}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t border-white/5 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleExecutarAgora(auto.id)}
                  disabled={executandoId === auto.id}
                  className="h-8 text-xs text-[#22c55e] hover:text-white hover:bg-[#22c55e]/20 gap-1.5 font-bold"
                >
                  {executandoId === auto.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PlayCircle className="w-3.5 h-3.5" />
                  )}
                  Enviar Agora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => abrirEditar(auto)}
                  className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/5 gap-1.5 font-bold"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(auto.id)}
                  className="h-8 text-xs text-red-400 hover:text-white hover:bg-red-500/20 gap-1.5 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-3xl">
          <DialogHeader className="border-b border-white/5 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#22c55e]" />
              {editId ? "Editar Agendamento" : "Criar Agendamento Automático"}
            </DialogTitle>
            <p className="text-xs text-slate-400">Configure as regras de envio do WhatsApp.</p>
          </DialogHeader>

          <div className="px-6 py-4 border-b border-white/5 bg-slate-950/30">
            <div className="flex justify-between items-center max-w-xs mx-auto">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${wizardStep === step ? "bg-[#22c55e] text-white shadow-md shadow-[#22c55e]/20" : wizardStep > step ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-white/5 text-white/40"}`}>
                    {step}
                  </div>
                  <span className={`text-[10px] font-bold ${wizardStep === step ? "text-white" : "text-white/40"}`}>
                    {step === 1 ? "Geral" : step === 2 ? "Frequência" : "Alvos"}
                  </span>
                  {step < 3 && <div className="w-6 h-px bg-white/10" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Nome do Agendamento</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Envio Semanal de FICAI"
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Tipo de Mensagem/Documento</Label>
                  <select
                    value={form.tipoDocumento}
                    onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value, documentoEscopo: "todas", documentoAlvo: "", documentoMes: "atual" })}
                    className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                  >
                    <option value="mensagem">Mensagem de Texto Livre</option>
                    <option value="ficai">📋 FICAI (Ficha de Aluno Infrequente)</option>
                    <option value="freq_mensal">📊 Frequência Mensal</option>
                    <option value="resumo_turma">📝 Resumo de Turma</option>
                    <option value="pre_diario">📆 Pré-diário</option>
                  </select>
                </div>

                {form.tipoDocumento && form.tipoDocumento !== "mensagem" && (
                  <div className="space-y-4 border border-white/5 bg-white/5 p-4 rounded-2xl">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-[#22c55e]">Configurações do Documento</h5>
                    
                    <div>
                      <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1 block text-[11px]">Mês de Referência</Label>
                      <select
                        value={form.documentoMes}
                        onChange={(e) => setForm({ ...form, documentoMes: e.target.value })}
                        className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#22c55e] text-xs font-semibold"
                      >
                        <option value="atual">Mês Atual (Automático)</option>
                        <option value="1">Janeiro</option>
                        <option value="2">Fevereiro</option>
                        <option value="3">Março</option>
                        <option value="4">Abril</option>
                        <option value="5">Maio</option>
                        <option value="6">Junho</option>
                        <option value="7">Julho</option>
                        <option value="8">Agosto</option>
                        <option value="9">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1 block text-[11px]">Escopo do Documento</Label>
                      <select
                        value={form.documentoEscopo}
                        onChange={(e) => setForm({ ...form, documentoEscopo: e.target.value, documentoAlvo: "" })}
                        className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#22c55e] text-xs font-semibold"
                      >
                        {(form.tipoDocumento === "ficai" || form.tipoDocumento === "freq_mensal") && (
                          <option value="aluno">Aluno Específico</option>
                        )}
                        <option value="turma">Turma(s)</option>
                        <option value="todas">Todas as Turmas</option>
                      </select>
                    </div>

                    {form.documentoEscopo === "turma" && (
                      <div>
                        <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5 block text-[11px]">Selecione a(s) Turma(s)</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-black/20 rounded-lg border border-white/5">
                          {turmas.map(t => {
                            const selecionado = (form.documentoAlvo || "").split(",").includes(t.nomeTurma);
                            return (
                              <label key={t.id} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer p-1 rounded hover:bg-white/5">
                                <input
                                  type="checkbox"
                                  checked={selecionado}
                                  onChange={(e) => {
                                    const atual = (form.documentoAlvo || "").split(",").filter(Boolean);
                                    let novo;
                                    if (e.target.checked) {
                                      novo = [...atual, t.nomeTurma];
                                    } else {
                                      novo = atual.filter((n: string) => n !== t.nomeTurma);
                                    }
                                    setForm({ ...form, documentoAlvo: novo.join(",") });
                                  }}
                                  className="rounded border-white/10 text-[#22c55e] focus:ring-[#22c55e] focus:ring-offset-0 bg-[#1e293b] w-3.5 h-3.5"
                                />
                                {t.nomeTurma}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {form.documentoEscopo === "aluno" && (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1 block text-[11px]">Filtrar por Turma</Label>
                          <select
                            value={turmaSelecionadaParaAluno}
                            onChange={(e) => setTurmaSelecionadaParaAluno(e.target.value)}
                            className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#22c55e] text-xs font-semibold"
                          >
                            <option value="">Selecione a turma...</option>
                            {turmas.map(t => (
                              <option key={t.nomeTurma} value={t.nomeTurma}>{t.nomeTurma}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1 block text-[11px]">Selecione o Aluno</Label>
                          <select
                            value={form.documentoAlvo}
                            onChange={(e) => setForm({ ...form, documentoAlvo: e.target.value })}
                            className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#22c55e] text-xs font-semibold"
                            disabled={!turmaSelecionadaParaAluno}
                          >
                            <option value="">Selecione o aluno...</option>
                            {alunosDaTurma.map(a => (
                              <option key={a.id} value={a.id}>{a.nomeCompleto}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">
                    {form.tipoDocumento === "mensagem" ? "Mensagem Livre" : "Mensagem/Legenda Adicional"}
                  </Label>
                  <Textarea
                    value={form.mensagem}
                    onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                    placeholder={form.tipoDocumento === "mensagem" ? "Escreva a mensagem. Use {nome} para inserir o nome do destinatário." : "Adicione uma legenda opcional para acompanhar o arquivo..."}
                    className="bg-black/40 border-white/10 text-white min-h-[100px]"
                  />
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider block">Arquivo Complementar (Opcional)</Label>
                  {form.nomeArquivo ? (
                    <div className="flex justify-between items-center bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                      <span className="text-xs font-bold text-sky-400 truncate max-w-[250px]">{form.nomeArquivo}</span>
                      <button 
                        type="button" 
                        onClick={() => setForm({ ...form, arquivoBase64: "", nomeArquivo: "", mimetype: "" })}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative border border-dashed border-white/20 hover:border-white/40 rounded-lg p-3 text-center cursor-pointer transition-all">
                      <input 
                        type="file" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const base64 = (reader.result as string).split(",")[1];
                            setForm({
                              ...form,
                              arquivoBase64: base64,
                              nomeArquivo: file.name,
                              mimetype: file.type
                            });
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                      />
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="w-5 h-5 text-white/50" />
                        <span className="text-xs text-white/50 font-bold">Clique para anexar um arquivo</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Frequência</Label>
                  <select
                    value={form.frequencia}
                    onChange={(e) => setForm({ ...form, frequencia: e.target.value })}
                    className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                  >
                    <option value="unico">Executar uma única vez</option>
                    <option value="imediato">Enviar imediatamente</option>
                    <option value="diario">Diariamente</option>
                    <option value="semanal">Semanalmente (Escolher dias)</option>
                    <option value="mensal">Mensalmente (Escolher dia do mês)</option>
                  </select>
                </div>

                {form.frequencia === "semanal" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Dias de Envio</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: "Dom", value: 0 },
                        { label: "Seg", value: 1 },
                        { label: "Ter", value: 2 },
                        { label: "Qua", value: 3 },
                        { label: "Qui", value: 4 },
                        { label: "Sex", value: 5 },
                        { label: "Sáb", value: 6 }
                      ].map((d) => {
                        const selecionado = form.diasSemana.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => {
                              const novos = selecionado
                                ? form.diasSemana.filter((v: number) => v !== d.value)
                                : [...form.diasSemana, d.value];
                              setForm({ ...form, diasSemana: novos });
                            }}
                            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all border ${selecionado ? "bg-[#22c55e] border-[#22c55e] text-white shadow-lg shadow-[#22c55e]/20" : "bg-white/5 border-white/10 text-white/60 hover:text-white"}`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.frequencia === "mensal" && (
                  <div className="space-y-2">
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider block">Dias do Mês para Envio</Label>
                    
                    {/* Lista de dias selecionados */}
                    <div className="flex gap-2 flex-wrap mb-2">
                      {(form.diasMes || "").split(",").filter(Boolean).map((d) => (
                        <span key={d} className="bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          Dia {d}
                          <button
                            type="button"
                            onClick={() => {
                              const novos = (form.diasMes || "").split(",").filter((v) => v !== d);
                              setForm({ ...form, diasMes: novos.join(",") });
                            }}
                            className="text-red-400 hover:text-red-300 font-bold ml-1 text-sm focus:outline-none"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {(form.diasMes || "").split(",").filter(Boolean).length === 0 && (
                        <span className="text-xs text-white/40 italic">Nenhum dia adicionado.</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="number"
                        id="novo-dia-mes-input"
                        min="1"
                        max="31"
                        placeholder="Ex: 10"
                        className="bg-black/40 border-white/10 text-white flex-1 h-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = e.currentTarget.value;
                            if (val && !isNaN(Number(val))) {
                              const diaNum = parseInt(val);
                              if (diaNum >= 1 && diaNum <= 31) {
                                const diasAtuais = (form.diasMes || "").split(",").filter(Boolean);
                                if (!diasAtuais.includes(String(diaNum))) {
                                  setForm({ ...form, diasMes: [...diasAtuais, String(diaNum)].join(",") });
                                }
                                e.currentTarget.value = "";
                              }
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("novo-dia-mes-input");
                          if (input) {
                            const val = input.value;
                            if (val && !isNaN(Number(val))) {
                              const diaNum = parseInt(val);
                              if (diaNum >= 1 && diaNum <= 31) {
                                const diasAtuais = (form.diasMes || "").split(",").filter(Boolean);
                                if (!diasAtuais.includes(String(diaNum))) {
                                  setForm({ ...form, diasMes: [...diasAtuais, String(diaNum)].join(",") });
                                }
                                input.value = "";
                              }
                            }
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold px-3 h-9"
                      >
                        + Adicionar
                      </Button>
                    </div>
                    <p className="text-[10px] text-white/40">Digite um dia (1-31) e pressione Enter ou clique no botão para adicionar.</p>
                  </div>
                )}

                {form.frequencia !== "imediato" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Horário de Envio</Label>
                    <Input
                      type="time"
                      value={form.horario}
                      onChange={(e) => setForm({ ...form, horario: e.target.value })}
                      className="bg-black/40 border-white/10 text-white text-lg font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Enviar para quem?</Label>
                  <select
                    value={form.destinatarioTipo}
                    onChange={(e) => setForm({ ...form, destinatarioTipo: e.target.value, destinatarioValor: "" })}
                    className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                  >
                    <option value="numero">Número de Telefone Específico</option>
                    <option value="professor">Um Professor Específico</option>
                    <option value="todos_professores">Todos os Professores</option>
                    <option value="grupo">Grupo da Escola</option>
                    <option value="turma_alunos">Alunos de uma Turma</option>
                    <option value="todos_alunos">Todos os Alunos</option>
                    <option value="funcionarios">Equipe de Funcionários</option>
                  </select>
                </div>

                {form.destinatarioTipo === "numero" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Número do WhatsApp (com DDD)</Label>
                    <Input
                      value={form.destinatarioValor}
                      onChange={(e) => setForm({ ...form, destinatarioValor: e.target.value.replace(/\D/g, "") })}
                      placeholder="Ex: 22981310965"
                      className="bg-black/40 border-white/10 text-white font-mono"
                    />
                  </div>
                )}

                {form.destinatarioTipo === "professor" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Selecione o Professor</Label>
                    <select
                      value={form.destinatarioValor}
                      onChange={(e) => setForm({ ...form, destinatarioValor: e.target.value })}
                      className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                    >
                      <option value="">Selecione o professor...</option>
                      {professores.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.destinatarioTipo === "grupo" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Selecione o Grupo da Escola</Label>
                    <select
                      value={form.destinatarioValor}
                      onChange={(e) => setForm({ ...form, destinatarioValor: e.target.value })}
                      className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                    >
                      <option value="">Selecione o grupo...</option>
                      <option value="grupo_da_escola">Grupo da Escola (Oficial)</option>
                      {grupos.filter(g => g.jid !== escolaGrupoJid && g.jid !== "grupo_da_escola").map(g => (
                        <option key={g.jid} value={g.jid}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {form.destinatarioTipo === "turma_alunos" && (
                  <div>
                    <Label className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 block">Selecione a Turma</Label>
                    <select
                      value={form.destinatarioValor}
                      onChange={(e) => setForm({ ...form, destinatarioValor: e.target.value })}
                      className="w-full bg-[#1e293b] text-white border border-white/10 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#22c55e] text-sm font-semibold"
                    >
                      <option value="">Selecione a turma...</option>
                      {turmas.map(t => (
                        <option key={t.nomeTurma} value={t.nomeTurma}>{t.nomeTurma}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/5 p-6 flex justify-between bg-slate-950/20">
            <Button
              type="button"
              variant="ghost"
              disabled={wizardStep === 1}
              onClick={() => setWizardStep(wizardStep - 1)}
              className="text-white/60 hover:text-white font-bold"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>

            <div className="flex gap-2">
              {wizardStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold"
                >
                  Avançar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <>
                  {!editId && (
                    <Button
                      type="button"
                      onClick={() => handleSalvar(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold"
                    >
                      + Outra
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => handleSalvar(false)}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold"
                  >
                    <Check className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecaoWhatsAppLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { toast } = useToast();

  const carregarLogs = async () => {
    try {
      const res = await fetch(API("/whatsapp/logs"));
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarLogs();
    const interval = setInterval(carregarLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h4 className="text-md font-bold text-white uppercase tracking-wider">Histórico de Fluxo do Bot</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (logs.length > 0) {
                const html = obterHtmlLogWhatsApp(logs);
                imprimirLogOnline("RICOH", "Histórico de Fluxo do Bot", html, toast);
              } else {
                toast({ title: "Sem logs", description: "Não há logs para imprimir.", variant: "destructive" });
              }
            }}
            variant="outline"
            size="sm"
            className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 text-xs font-bold h-8"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Ricoh (Online)
          </Button>
          <Button
            onClick={() => {
              if (logs.length > 0) {
                const html = obterHtmlLogWhatsApp(logs);
                imprimirLogOnline("EPSON", "Histórico de Fluxo do Bot", html, toast);
              } else {
                toast({ title: "Sem logs", description: "Não há logs para imprimir.", variant: "destructive" });
              }
            }}
            variant="outline"
            size="sm"
            className="bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/20 text-xs font-bold h-8"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Epson (Online)
          </Button>
          <Button
            onClick={() => {
              if (logs.length > 0) {
                const html = obterHtmlLogWhatsApp(logs);
                imprimirLogLocal("Histórico de Fluxo do Bot", html, toast);
              } else {
                toast({ title: "Sem logs", description: "Não há logs para imprimir.", variant: "destructive" });
              }
            }}
            variant="outline"
            size="sm"
            className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-bold h-8"
          >
            <Wifi className="h-3.5 w-3.5 mr-1.5" /> Imprimir (Rede Local)
          </Button>
          <Button onClick={carregarLogs} variant="outline" size="sm" className="gap-2 text-white border-white/10 hover:bg-white/5 h-8">
            <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>
      </div>
      
      <div className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-xs text-green-400 overflow-y-auto max-h-[400px] space-y-1 h-[400px]">
        {carregando ? (
          <div className="flex justify-center items-center h-full text-white/40">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="flex justify-center items-center h-full text-white/40 italic">Nenhum log registrado ainda.</div>
        ) : (
          logs.map((line, idx) => (
            <div key={idx} className="whitespace-pre-wrap">{line}</div>
          ))
        )}
      </div>
    </div>
  );
}

function SecaoWhatsAppFila() {
  const [queue, setQueue] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { toast } = useToast();

  const carregarQueue = async () => {
    try {
      const res = await fetch(API("/whatsapp/queue"));
      const data = await res.json();
      setQueue(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarQueue();
    const interval = setInterval(carregarQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = async (id: number) => {
    try {
      const res = await fetch(API(`/whatsapp/queue/${id}/resend`), { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Mensagem marcada para reenvio!" });
      carregarQueue();
    } catch (e) {
      toast({ title: "Erro ao reenviar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(API(`/whatsapp/queue/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Mensagem deletada da fila!" });
      carregarQueue();
    } catch (e) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-bold text-white uppercase tracking-wider">Fila de Disparos de Mensagens</h4>
        <Button onClick={carregarQueue} variant="outline" size="sm" className="gap-2 text-white border-white/10 hover:bg-white/5 h-8">
          <RefreshCcw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      <div className="bg-[#1a2332] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/70">
            <thead className="bg-white/5 text-[10px] text-white/50 font-bold uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-4 px-6">Destinatário</th>
                <th className="py-4 px-6">Mensagem / Anexo</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Criado em</th>
                <th className="py-4 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {carregando ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/40">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Carregando fila...
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-white/40 italic">
                    Nenhuma mensagem na fila de envio.
                  </td>
                </tr>
              ) : (
                queue.map((msg) => {
                  const isErro = msg.status === "Erro";
                  const statusColor = 
                    msg.status === "Pendente" ? "text-orange-400 bg-orange-500/10 border-orange-500/30" :
                    msg.status === "Enviado" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
                    "text-red-400 bg-red-500/10 border-red-500/30";
                  return (
                    <tr key={msg.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs">{msg.numero}</td>
                      <td className="py-4 px-6 max-w-xs">
                        <div className="truncate text-xs text-white" title={msg.mensagem}>
                          {msg.mensagem || <span className="italic text-white/30">Sem texto</span>}
                        </div>
                        {msg.nomeArquivo && (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-sky-400">
                            <FileText className="w-3 h-3" /> {msg.nomeArquivo}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 ${statusColor}`}>
                          {msg.status}
                          {isErro && msg.erro && (
                            <span className="text-[9px] text-white/40 ml-1 font-normal block max-w-[120px] truncate" title={msg.erro}>
                              ({msg.erro})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-white/40">
                        {new Date(msg.criadoEm).toLocaleDateString("pt-BR")} {new Date(msg.criadoEm).toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {(msg.status === "Erro" || msg.status === "Enviado") && (
                          <Button
                            onClick={() => handleResend(msg.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-white/5"
                            title="Reenviar"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(msg.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-300 hover:bg-white/5"
                          title="Deletar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SecaoWhatsApp() {
  const [subSecao, setSubSecao] = useState<"conexao" | "automacoes" | "fila" | "logs">("conexao");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex gap-2 bg-[#1a2332] p-1.5 rounded-2xl border border-white/5 max-w-lg">
        <button
          onClick={() => setSubSecao("conexao")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${subSecao === "conexao" ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/15" : "text-white/60 hover:text-white"}`}
        >
          Conexão Bot
        </button>
        <button
          onClick={() => setSubSecao("automacoes")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${subSecao === "automacoes" ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/15" : "text-white/60 hover:text-white"}`}
        >
          ⚡ Agendamentos
        </button>
        <button
          onClick={() => setSubSecao("fila")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${subSecao === "fila" ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/15" : "text-white/60 hover:text-white"}`}
        >
          📋 Fila de Envio
        </button>
        <button
          onClick={() => setSubSecao("logs")}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${subSecao === "logs" ? "bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/15" : "text-white/60 hover:text-white"}`}
        >
          📝 Logs do Bot
        </button>
      </div>

      {subSecao === "conexao" && <SecaoWhatsAppConexao />}
      {subSecao === "automacoes" && <SecaoWhatsAppAutomacoes />}
      {subSecao === "fila" && <SecaoWhatsAppFila />}
      {subSecao === "logs" && <SecaoWhatsAppLogs />}
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
      case "contatos":       return <SecaoContatos />;
      case "diario":         return <SecaoConfigDiario />;
      case "whatsapp":       return <SecaoWhatsApp />;
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

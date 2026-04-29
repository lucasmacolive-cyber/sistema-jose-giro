// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMe } from "@workspace/api-client-react";
import {
  Printer, Plus, FileText, CheckCircle2, XCircle, Clock,
  Loader2, Link as LinkIcon, Upload, Trash2, Copy, ExternalLink,
  RefreshCw, AlertCircle, File, ImageIcon, Zap, BellRing, X, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { motion, AnimatePresence } from "framer-motion";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API  = (path: string) => `${BASE}api/${path}`;

// ─── tipos ────────────────────────────────────────────────────────────────────
type Impressao = {
  id: number;
  dataPedido: string | null;
  professorSolicitante: string;
  linkArquivo: string;
  nomeArquivo: string | null;
  tipoArquivo: string | null;
  observacoes: string | null;
  quantidadeCopias: number;
  duplex: boolean | null;
  colorida: boolean | null;
  dataParaUso: string | null;
  horarioImpressao: string | null;
  status: string;
  lido: boolean | null;
  imprimiuEm: string | null;
  progresso: number | null;
  mensagemStatus: string | null;
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtData(s: string | null) {
  if (!s) return "–";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return s; }
}
function fmtHora(s: string | null) {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function isImagem(tipo: string | null) {
  return tipo?.startsWith("image/") ?? false;
}
function isPdf(tipo: string | null) {
  return tipo === "application/pdf";
}
function statusConfig(status: string) {
  switch (status) {
    case "Pendente":   return { cor: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: Clock, label: "Pendente" };
    case "Imprimindo": return { cor: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: Printer, label: "Imprimindo" };
    case "Impresso":   return { cor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, label: "Impresso" };
    case "Cancelado":  return { cor: "text-red-400 bg-red-500/10 border-red-500/30", icon: XCircle, label: "Cancelado" };
    default:           return { cor: "text-white/50 bg-white/5 border-white/10", icon: FileText, label: status };
  }
}

// ─── Card de impressão ────────────────────────────────────────────────────────
function CardImpressao({ imp, isAdmin, onAtualizar, onImprimirAgora, onDeletar }: {
  imp: Impressao; isAdmin: boolean;
  onAtualizar: (id: number, status: string) => void;
  onImprimirAgora: (id: number) => void;
  onDeletar: (id: number) => void;
}) {
  const cfg     = statusConfig(imp.status);
  const Icon    = cfg.icon;
  const interno = imp.linkArquivo.startsWith("/api/impressoes/arquivo/");
  const filename = interno ? imp.linkArquivo.replace("/api/impressoes/arquivo/", "") : null;
  const urlVisualizar = filename
    ? `${window.location.origin}${BASE}api/impressoes/visualizar/${encodeURIComponent(filename)}?copies=${imp.quantidadeCopias ?? 1}&duplex=${imp.duplex ? "true" : "false"}`
    : imp.linkArquivo;
  const urlFull = filename
    ? `${window.location.origin}${BASE}api/impressoes/arquivo/${filename}`
    : imp.linkArquivo;

  const isPendente  = imp.status === "Pendente";
  const isAgendado  = isPendente && !!imp.dataParaUso; // tem data/hora programada

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-white/8 bg-white/4 hover:bg-white/6 transition-colors overflow-hidden"
    >
      <div className="flex items-start gap-4 p-4">
        {/* Ícone tipo arquivo */}
        <div className="w-11 h-11 rounded-xl bg-black/30 border border-white/8 flex items-center justify-center shrink-0">
          {isPdf(imp.tipoArquivo)     ? <FileText className="h-5 w-5 text-red-400" /> :
           isImagem(imp.tipoArquivo) ? <ImageIcon className="h-5 w-5 text-sky-400" /> :
                                       <File className="h-5 w-5 text-white/40" />}
        </div>

        {/* Corpo */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{imp.professorSolicitante}</span>
            <Badge variant="outline" className={`text-[10px] py-0 px-2 border ${cfg.cor}`}>
              <Icon className="h-3 w-3 mr-1 inline" />{cfg.label}
            </Badge>
            {imp.colorida ? (
              <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/20 rounded-full px-2 py-0.5">🎨 Colorida</span>
            ) : (
              <span className="text-[10px] bg-white/5 text-white/40 border border-white/10 rounded-full px-2 py-0.5">⬛ P&B</span>
            )}
            {imp.duplex && (
              <span className="text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/20 rounded-full px-2 py-0.5">Frente e verso</span>
            )}
          </div>

          <p className="text-xs text-white/50 truncate">
            {imp.nomeArquivo || "Arquivo externo"}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40 mt-1">
            <span>Pedido: {fmtData(imp.dataPedido)} {fmtHora(imp.dataPedido)}</span>
            {imp.dataParaUso && (
              <span>
                Agendado: <span className="text-amber-400/80">
                  {fmtData(imp.dataParaUso)}
                  {imp.horarioImpressao && <> às <strong>{imp.horarioImpressao}</strong></>}
                </span>
              </span>
            )}
            <span className="font-mono text-white/60"><strong className="text-white/80">{imp.quantidadeCopias}</strong> cópia{imp.quantidadeCopias > 1 ? "s" : ""}</span>
            {imp.imprimiuEm && <span>Impresso: {fmtData(imp.imprimiuEm)}</span>}
          </div>

          {imp.observacoes && (
            <p className="text-[11px] text-amber-300/70 bg-amber-500/8 rounded-md px-2 py-1 mt-1 border border-amber-500/15">
              {imp.observacoes}
            </p>
          )}

          {/* Barra de Progresso Real */}
          {imp.status === "Imprimindo" && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-blue-400 font-medium animate-pulse">
                  {imp.mensagemStatus || "Processando..."}
                </span>
                <span className="text-white/40">{imp.progresso || 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${imp.progresso || 5}%` }}
                  className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Ações — canto superior direito */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* "Imprimir agora" — só para admin em jobs com horário agendado */}
          {isAdmin && isAgendado && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-400/60 font-semibold transition-all"
              onClick={() => onImprimirAgora(imp.id)}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />Imprimir agora
            </Button>
          )}

          {/* Ver arquivo — disponível para todos, abre o arquivo bruto sem dialog */}
          <a
            href={urlFull}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-sky-400/80 hover:text-sky-300 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver arquivo
          </a>

          {/* Cancelar — disponível para todos em jobs pendentes */}
          {isPendente && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/25 hover:border-red-400/50 font-semibold transition-all"
              onClick={() => onAtualizar(imp.id, "Cancelado")}
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancelar
            </Button>
          )}

          {/* Deletar Permanente — disponível para todos para interromper impressão ou limpar registro */}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-white/20 hover:text-red-400 hover:bg-red-500/10"
            onClick={() => onDeletar(imp.id)}
            title="Excluir permanentemente"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

    </motion.div>
  );
}

// ─── Formulário de novo pedido ────────────────────────────────────────────────
function FormNovoPedido({ onSucesso, nomeUsuario }: { onSucesso: () => void; nomeUsuario: string }) {
  const { toast } = useToast();
  const [modo, setModo]               = useState<"arquivo" | "link">("arquivo");
  const [nome, setNome]               = useState(nomeUsuario);
  const [copias, setCopias]           = useState(1);
  const [data, setData]               = useState("");
  const [horario, setHorario]         = useState("");
  const [obs, setObs]                 = useState("");
  const [duplex, setDuplex]           = useState(false);
  const [colorida, setColorida]       = useState(false);
  const [link, setLink]               = useState("");
  const [arquivo, setArquivo]         = useState<File | null>(null);
  const [enviando, setEnviando]       = useState(false);
  const [imprimirAgora, setImprimirAgora] = useState(false);
  const inputRef                      = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setArquivo(f);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast({ title: "Informe seu nome", variant: "destructive" }); return; }
    if (modo === "arquivo" && !arquivo) { toast({ title: "Selecione um arquivo", variant: "destructive" }); return; }
    if (modo === "link" && !link.trim()) { toast({ title: "Informe o link", variant: "destructive" }); return; }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("professorSolicitante", nome.trim());
      form.append("quantidadeCopias", String(copias));
      form.append("duplex", String(duplex));
      form.append("colorida", String(colorida));
      if (!imprimirAgora && data)    form.append("dataParaUso", data);
      if (!imprimirAgora && horario) form.append("horarioImpressao", horario);
      if (obs)     form.append("observacoes", obs.trim());
      if (modo === "arquivo" && arquivo) form.append("arquivo", arquivo);
      if (modo === "link")   form.append("linkArquivo", link.trim());

      const res = await fetch(API("impressoes"), { method: "POST", body: form, credentials: "include" });
      if (!res.ok) throw new Error("Erro ao enviar");
      toast({ title: imprimirAgora ? "Enviado! Imprimindo agora na Ricoh..." : "Pedido agendado com sucesso!" });
      onSucesso();
    } catch {
      toast({ title: "Erro ao enviar pedido", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-white/50">Seu nome</Label>
        <Input value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Nome completo" className="bg-black/20 border-white/10 h-9 text-sm" />
      </div>

      {/* Tabs arquivo / link */}
      <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
        {(["arquivo", "link"] as const).map(m => (
          <button key={m} type="button"
            onClick={() => setModo(m)}
            className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${modo === m ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
          >
            {m === "arquivo" ? <><Upload className="inline h-3.5 w-3.5 mr-1" />Enviar arquivo</> : <><LinkIcon className="inline h-3.5 w-3.5 mr-1" />Link externo</>}
          </button>
        ))}
      </div>

      {modo === "arquivo" ? (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed cursor-pointer transition-all p-5 text-center
            ${arquivo ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 hover:border-white/20 bg-white/3"}`}
        >
          <input ref={inputRef} type="file" hidden accept=".pdf,image/*"
            onChange={e => { if (e.target.files?.[0]) setArquivo(e.target.files[0]); }} />
          {arquivo ? (
            <div className="space-y-1">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto" />
              <p className="text-sm text-emerald-300 font-medium truncate">{arquivo.name}</p>
              <p className="text-xs text-white/30">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="h-6 w-6 text-white/20 mx-auto" />
              <p className="text-xs text-white/40">Arraste ou clique para selecionar</p>
              <p className="text-[10px] text-white/20">PDF ou imagens · máx 20 MB</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-white/50">Link do arquivo (Google Drive, etc)</Label>
          <Input value={link} onChange={e => setLink(e.target.value)}
            placeholder="https://drive.google.com/..." className="bg-black/20 border-white/10 h-9 text-sm" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-white/50">Nº de cópias</Label>
        <Input type="number" min={1} max={200} value={copias} onChange={e => setCopias(Number(e.target.value))}
          className="bg-black/20 border-white/10 h-9 text-sm" />
      </div>

      {/* Toggle: Imprimir Agora × Agendar */}
      <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
        <button type="button"
          onClick={() => setImprimirAgora(false)}
          className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            !imprimirAgora ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
        >
          <Clock className="h-3.5 w-3.5" />
          Agendar horário
        </button>
        <button type="button"
          onClick={() => setImprimirAgora(true)}
          className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            imprimirAgora
              ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
              : "text-white/40 hover:text-white/70"}`}
        >
          <Zap className="h-3.5 w-3.5" />
          Imprimir agora!
        </button>
      </div>

      {/* Campos de data/hora — só aparecem se NÃO for "Imprimir Agora" */}
      {!imprimirAgora && (
        <div className="space-y-1.5">
          <Label className="text-xs text-white/50">Agendar impressão para</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={data} onChange={e => setData(e.target.value)}
              className="bg-black/20 border-white/10 h-9 text-sm" />
            <Input type="time" value={horario} onChange={e => setHorario(e.target.value)}
              className="bg-black/20 border-white/10 h-9 text-sm" />
          </div>
        </div>
      )}

      {/* Aviso quando "Imprimir Agora" está ativo */}
      {imprimirAgora && (
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-[12px] text-emerald-300/80">
            O arquivo entrará na fila imediatamente e será impresso na <strong>Ricoh SP 3710sf</strong> em até 30 segundos.
          </p>
        </div>
      )}

      {/* Seleção de Impressora */}
      <div className="space-y-1.5">
        <Label className="text-xs text-white/50">Tipo de Impressão</Label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setColorida(false)}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
              !colorida ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-white/40 hover:bg-white/5"
            }`}
          >
            <span className="text-sm font-semibold mb-0.5">⬛ Padrão (P&B)</span>
            <span className="text-[10px] opacity-70">Ricoh SP 3710SF</span>
          </button>
          <button type="button" onClick={() => setColorida(true)}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
              colorida ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-black/20 border-white/5 text-white/40 hover:bg-white/5"
            }`}
          >
            <span className="text-sm font-semibold mb-0.5">🎨 Colorida</span>
            <span className="text-[10px] opacity-70">Epson L3250</span>
          </button>
        </div>
        {colorida && (
          <p className="text-[10px] text-sky-300/80 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Lembre-se de usar impressão colorida apenas quando necessário.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={duplex} onChange={e => setDuplex(e.target.checked)}
          className="w-4 h-4 rounded accent-violet-500" />
        <span className="text-sm text-white/70">Imprimir frente e verso</span>
      </label>

      <div className="space-y-1.5">
        <Label className="text-xs text-white/50">Observações (opcional)</Label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
          placeholder="Ex: imprimir frente e verso, papel A4..."
          className="w-full rounded-xl bg-black/20 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-sky-500/40 placeholder:text-white/20"
        />
      </div>

      <Button type="submit" disabled={enviando}
        className={`w-full text-white h-10 font-semibold transition-all ${
          imprimirAgora
            ? "bg-emerald-600/80 hover:bg-emerald-600 shadow-lg shadow-emerald-900/30"
            : "bg-sky-600/80 hover:bg-sky-600"
        }`}
      >
        {enviando
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : imprimirAgora
            ? <Zap className="h-4 w-4 mr-2" />
            : <Printer className="h-4 w-4 mr-2" />
        }
        {imprimirAgora ? "Enviar e Imprimir Agora!" : "Enviar pedido de impressão"}
      </Button>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ImpressoesPage() {
  const { toast }            = useToast();
  const { data: user }       = useGetMe();
  const isAdmin              = user?.perfil === "Master" || user?.perfil === "Direção";

  const [impressoes, setImpressoes]       = useState<Impressao[]>([]);
  const [carregando, setCarregando]       = useState(false);
  const [filtro, setFiltro]               = useState<"todos" | "Pendente" | "Impresso" | "Cancelado">("todos");
  const [showForm, setShowForm]           = useState(false);
  const [linkCopiado, setLinkCopiado]     = useState(false);
  const [alertaPrint, setAlertaPrint]     = useState<Impressao | null>(null);
  const [printEmAndamento, setPrintEmAndamento] = useState<Impressao | null>(null);
  const [showHistorico, setShowHistorico]       = useState(false);

  // Controle de auto-impressão
  const [agenteOnline, setAgenteOnline] = useState(false);
  const knownIds            = useRef<Set<number>>(new Set());
  const printedIds          = useRef<Set<number>>(new Set());
  const isFirstPoll         = useRef(true);
  const cancelTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrintTimers  = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const linkPublico = `${window.location.origin}${BASE}impressao-atividades-giro`;

  // Constrói URL da página de visualização com cópias e duplex
  function buildVisualizarUrl(imp: Impressao): string | null {
    if (!imp.linkArquivo.startsWith("/api/impressoes/arquivo/")) return null;
    const filename = imp.linkArquivo.replace("/api/impressoes/arquivo/", "");
    const copies   = imp.quantidadeCopias ?? 1;
    const duplex   = imp.duplex ? "true" : "false";
    return `${window.location.origin}${BASE}api/impressoes/visualizar/${encodeURIComponent(filename)}?copies=${copies}&duplex=${duplex}`;
  }

  // Verifica se o job já está no horário correto
  function isJobDue(imp: Impressao): boolean {
    if (!imp.dataParaUso) return true;
    try {
      const scheduled = new Date(`${imp.dataParaUso}T${imp.horarioImpressao ?? "00:00"}:00`);
      return new Date() >= scheduled;
    } catch { return true; }
  }

  // ── Cancela print (antes ou durante execução) ────────────────────────────────
  async function cancelarPrintEmAndamento(imp: Impressao) {
    // Para o timer pendente se ainda não executou
    const timer = pendingPrintTimers.current.get(imp.id);
    if (timer) {
      clearTimeout(timer);
      pendingPrintTimers.current.delete(imp.id);
      printedIds.current.delete(imp.id); // permite re-detectar se voltar a Pendente
    }
    await fetch(API(`impressoes/${imp.id}/status`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Cancelado" }),
    });
    setPrintEmAndamento(null);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    toast({ title: "Impressão cancelada com sucesso!" });
    buscar();
  }

  // ── Executa a chamada real de impressão via agente Python ─────────────────────
  async function executarImpressao(imp: Impressao) {
    pendingPrintTimers.current.delete(imp.id);
    setPrintEmAndamento(null);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);

    try {
      // Sinaliza o agente: libera o job para impressão imediata
      await fetch(API(`impressoes/${imp.id}/imprimir-agora`), {
        method: "POST",
        credentials: "include",
      });

      // Atualiza a lista imediatamente (mostra que o job saiu da fila)
      buscar();

      toast({
        title: "🖨️ Enviado para a Ricoh!",
        description: `${imp.professorSolicitante} — ${imp.quantidadeCopias} cópia(s) · agente imprimindo agora`,
      });

      // Verifica em 45s se o agente imprimiu; se não, exibe alerta de fallback
      setTimeout(async () => {
        try {
          const res = await fetch(API("impressoes"), { credentials: "include" });
          if (!res.ok) return;
          const lista: Impressao[] = await res.json();
          const job = lista.find(j => j.id === imp.id);
          if (job && job.status === "Pendente") setAlertaPrint(imp);
          else buscar(); // Atualiza status visual
        } catch { /* ignore */ }
      }, 45000);
    } catch {
      // API falhou — mostra alerta para verificar o agente Python
      setAlertaPrint(imp);
    }
  }

  // ── Agenda impressão com delay (ex: 5s) — mostra banner de cancelamento já ──
  function agendarComDelay(imp: Impressao, delayMs: number) {
    setPrintEmAndamento(imp);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    // Banner visível durante todo o delay + 12s após execução
    cancelTimerRef.current = setTimeout(() => setPrintEmAndamento(null), delayMs + 12000);

    const timer = setTimeout(() => executarImpressao(imp), delayMs);
    pendingPrintTimers.current.set(imp.id, timer);
  }

  // ── Imprime imediatamente (jobs agendados que chegaram na hora) ───────────────
  async function tentarAutoImprimir(imp: Impressao) {
    setPrintEmAndamento(imp);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = setTimeout(() => setPrintEmAndamento(null), 12000);
    await executarImpressao(imp);
  }

  async function buscar() {
    setCarregando(true);
    try {
      const res = await fetch(API("impressoes"), { credentials: "include" });
      if (res.ok) setImpressoes(await res.json());
    } finally {
      setCarregando(false);
    }
  }

  // Auto-polling a cada 5 segundos
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(API("impressoes"), { credentials: "include" });
        if (!res.ok) return;
        const lista: Impressao[] = await res.json();
        setImpressoes(lista);

        if (!isAdmin) { isFirstPoll.current = false; return; }

        // Primeira rodada: registra todos os IDs sem auto-imprimir
        if (isFirstPoll.current) {
          isFirstPoll.current = false;
          lista.forEach(imp => knownIds.current.add(imp.id));
          return;
        }

        // Verifica novos pedidos ou agendados cujo horário chegou
        for (const imp of lista) {
          const jaConhecido = knownIds.current.has(imp.id);
          knownIds.current.add(imp.id);

          if (imp.status !== "Pendente") continue;
          if (printedIds.current.has(imp.id)) continue;

          const temAgendamento = !!imp.dataParaUso;
          const isDue          = isJobDue(imp);

          if (!jaConhecido) {
            // ── Job NOVO que chegou agora ────────────────────────────────────
            if (!temAgendamento) {
              // "Imprimir agora" — espera 5s e então imprime automaticamente
              printedIds.current.add(imp.id);
              agendarComDelay(imp, 5000);
              toast({
                title: "📨 Novo pedido! Imprimindo em 5 segundos…",
                description: `${imp.professorSolicitante} — ${imp.quantidadeCopias} cópia(s)`,
                action: (
                  <ToastAction
                    altText="Cancelar impressão"
                    onClick={() => cancelarPrintEmAndamento(imp)}
                    className="bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                  >
                    Cancelar
                  </ToastAction>
                ),
              });
            } else {
              // Agendado para data/hora futura — só notifica
              const dataFmt = new Date(`${imp.dataParaUso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              const horario  = imp.horarioImpressao ?? "00:00";
              toast({
                title: "📅 Pedido agendado recebido!",
                description: `${imp.professorSolicitante} — ${imp.quantidadeCopias} cópia(s) · ${dataFmt} às ${horario}`,
              });
            }
          } else if (temAgendamento && isDue) {
            // ── Job agendado que chegou na hora — imprime agora ───────────────
            printedIds.current.add(imp.id);
            tentarAutoImprimir(imp);
            toast({
              title: "⏰ Hora de imprimir!",
              description: `${imp.professorSolicitante} — ${imp.quantidadeCopias} cópia(s)`,
            });
          }
        }
      } catch { /* silent */ }
    }

    // Polling do status do robô (Heartbeat)
    async function checarAgente() {
      try {
        const res = await fetch(API("impressoes/status-agente"), { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAgenteOnline(data.online);
        }
      } catch { setAgenteOnline(false); }
    }

    poll();
    checarAgente();
    const interval = setInterval(() => { poll(); checarAgente(); }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  async function atualizar(id: number, status: string) {
    await fetch(API(`impressoes/${id}/status`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    toast({ title: status === "Impresso" ? "Marcado como impresso!" : "Pedido cancelado" });
    buscar();
  }

  async function deletar(id: number) {
    await fetch(API(`impressoes/${id}`), { method: "DELETE", credentials: "include" });
    buscar();
  }

  async function limparHistorico() {
    if (!isAdmin) return;
    if (!confirm("Tem certeza que deseja limpar todo o histórico de impressões (exceto pendentes)?")) return;
    
    try {
      const res = await fetch(API("impressoes/acao/limpar-historico"), { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Histórico limpo com sucesso!" });
        buscar();
      }
    } catch {
      toast({ title: "Erro ao limpar histórico", variant: "destructive" });
    }
  }

  async function imprimirAgora(id: number) {
    // Registra no printedIds para evitar double-trigger do polling automático
    printedIds.current.add(id);
    const res = await fetch(API(`impressoes/${id}/imprimir-agora`), {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      toast({
        title: "🖨️ Enviando para a Ricoh!",
        description: "Agente Python imprime em até 10s — antecipando agendamento",
      });
    }
    buscar();
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkPublico);
    setLinkCopiado(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setLinkCopiado(false), 2000);
  }

  const lista = filtro === "todos" ? impressoes : impressoes.filter(i => i.status === filtro);
  const pendentes = impressoes.filter(i => i.status === "Pendente").length;
  const historicoGeral = [...impressoes].sort((a, b) => new Date(b.dataPedido || 0).getTime() - new Date(a.dataPedido || 0).getTime());

  return (
    <AppLayout>
      {/* ── Banner de alerta quando agente Python não responde ── */}
      <AnimatePresence>
        {alertaPrint && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80 }}
            className="fixed bottom-6 right-6 z-[200] w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-orange-500 shadow-2xl shadow-orange-900/40 overflow-hidden border border-orange-400"
          >
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-white/20 p-2 mt-0.5">
                  <BellRing className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm leading-tight">Agente Python não respondeu</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    Verifique se o agente está rodando no PC da escola
                  </p>
                </div>
                <button onClick={() => setAlertaPrint(null)} className="text-white/60 hover:text-white mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="bg-white/15 rounded-xl px-3 py-2 flex items-center justify-between">
                <span className="text-white/80 text-xs truncate pr-2">{alertaPrint.nomeArquivo ?? "arquivo"}</span>
                <span className="text-white font-bold text-sm shrink-0">
                  {alertaPrint.quantidadeCopias ?? 1} cópia{(alertaPrint.quantidadeCopias ?? 1) > 1 ? "s" : ""}
                </span>
              </div>
              <Button
                className="w-full bg-red-600/30 hover:bg-red-600/50 border border-red-400/40 text-red-200 font-bold h-9 text-sm"
                onClick={() => { cancelarPrintEmAndamento(alertaPrint); setAlertaPrint(null); }}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Cancelar impressão
              </Button>
              <p className="text-[10px] text-white/60 text-center leading-tight">
                O pedido continua pendente — o agente imprimirá assim que reiniciar
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Banner "Cancelar antes que imprima" (janela de ~12s) ── */}
      <AnimatePresence>
        {printEmAndamento && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80 }}
            className="fixed bottom-6 left-6 z-[201] w-80 max-w-[calc(100vw-3rem)] rounded-2xl bg-[#1a0a0a] shadow-2xl shadow-red-900/50 overflow-hidden border border-red-500/40"
          >
            <div className="px-4 pt-4 pb-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-500/20 border border-red-500/30 p-2 mt-0.5">
                  <Printer className="h-4 w-4 text-red-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm leading-tight">Enviando para impressão…</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    {printEmAndamento.professorSolicitante} — {printEmAndamento.quantidadeCopias} cópia{printEmAndamento.quantidadeCopias > 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => { setPrintEmAndamento(null); if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current); }} className="text-white/40 hover:text-white mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-[11px] text-white/40 truncate">{printEmAndamento.nomeArquivo ?? "arquivo"}</p>
              </div>
              <Button
                className="w-full bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-300 hover:text-red-200 font-bold h-9 text-sm"
                onClick={() => cancelarPrintEmAndamento(printEmAndamento)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar impressão
              </Button>
              <p className="text-[10px] text-white/30 text-center">
                Cancele antes que o agente Python imprima (~10s)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6 pb-8">

        {/* ── Cabeçalho ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              Fila de Impressão
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 border border-white/5 text-[10px] font-medium uppercase tracking-wider">
                <span className={`h-2 w-2 rounded-full ${agenteOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" : "bg-red-500"}`} />
                <span className={agenteOnline ? "text-emerald-400/80" : "text-red-400/80"}>
                  Robô {agenteOnline ? "Online" : "Offline"}
                </span>
              </div>
              {pendentes > 0 && (
                <span className="text-base font-normal bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-3 py-0.5">
                  {pendentes} pendente{pendentes > 1 ? "s" : ""}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie pedidos de cópias enviados pelos professores.</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                onClick={() => setShowHistorico(true)}
                variant="outline"
                className="bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20 h-10 px-4 rounded-xl font-bold hidden sm:flex"
              >
                <History className="h-4 w-4 mr-2" />
                Histórico Geral (Master)
              </Button>
            )}
            <Button onClick={buscar} variant="ghost" size="icon" className="h-10 w-10 text-white/40 hover:text-white hover:bg-white/5">
              <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setShowForm(v => !v)}
              className="bg-sky-600/80 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Coluna esquerda: form + link ── */}
          <div className="space-y-4">
            {/* Formulário */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="bg-card/40 backdrop-blur-md border-white/8">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Plus className="h-4 w-4 text-sky-400" />
                        Novo pedido de impressão
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormNovoPedido
                        nomeUsuario={user?.nomeCompleto ?? ""}
                        onSucesso={() => { setShowForm(false); buscar(); }}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Link para professores */}
            <Card className="bg-card/40 backdrop-blur-md border-white/8">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <LinkIcon className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Link para professores</p>
                    <p className="text-[11px] text-white/40">Envie este link; eles não precisam fazer login</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg bg-black/30 border border-white/8 px-3 py-2 text-[11px] text-white/50 truncate font-mono">
                    {linkPublico}
                  </div>
                  <button
                    onClick={copiarLink}
                    className={`shrink-0 h-9 w-9 rounded-lg border flex items-center justify-center transition-all ${
                      linkCopiado ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                  : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {linkCopiado ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a
                    href={linkPublico}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 h-9 w-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="rounded-xl bg-amber-500/8 border border-amber-500/15 px-3 py-2 flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300/70">
                    O professor acessa esse link, envia o arquivo com as instruções, e o pedido aparece aqui automaticamente.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Instrução script impressora */}
            <Card className="bg-card/40 backdrop-blur-md border-white/8">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Printer className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Impressão automática</p>
                    <p className="text-[11px] text-white/40">Ricoh SP 3710sf — computador da escola</p>
                  </div>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Baixe o arquivo abaixo e dê duplo clique nele no computador da escola.
                  Ele instala tudo sozinho — Python, dependências e o agente —
                  e começa a imprimir automaticamente. Se cair a conexão, reinicia sozinho.
                </p>

                {/* Botão único de download */}
                <a
                  href={API("impressoes/iniciar-impressora.bat")}
                  download="iniciar-impressora.bat"
                  className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-emerald-200 hover:text-white hover:border-emerald-400/50 hover:from-emerald-600/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">iniciar-impressora.bat</p>
                    <p className="text-[11px] text-emerald-300/60">Duplo clique → instala tudo e começa</p>
                  </div>
                  <span className="text-[10px] text-emerald-400/50 shrink-0">1 arquivo</span>
                </a>

                {/* O que o arquivo faz */}
                <div className="space-y-1.5">
                  {[
                    ["✓", "Instala Python automaticamente se necessário"],
                    ["✓", "Baixa o agente atualizado do servidor"],
                    ["✓", "Instala os pacotes Python necessários"],
                    ["✓", "Roda em segundo plano — sem janela visível"],
                    ["✓", "Inicia sozinho ao ligar/logar no Windows"],
                    ["✓", "Reinicia automaticamente se cair"],
                  ].map(([icon, txt]) => (
                    <div key={txt} className="flex items-start gap-2">
                      <span className="text-emerald-400 text-[11px] font-bold shrink-0 mt-0.5">{icon}</span>
                      <span className="text-[11px] text-white/40">{txt}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2">
                  <p className="text-[11px] text-amber-300/70">
                    <strong className="text-amber-300">Para PDFs com melhor qualidade:</strong> instale o{" "}
                    <a href="https://www.sumatrapdfreader.org/download-free-pdf-viewer" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">SumatraPDF</a>{" "}
                    (gratuito). Imagens funcionam sem ele.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Coluna direita: fila ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap flex-1">
                {(["todos", "Pendente", "Impresso", "Cancelado"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltro(f)}
                    className={`h-8 px-4 rounded-lg text-xs font-medium transition-all border ${
                      filtro === f
                        ? "bg-white/12 border-white/20 text-white"
                        : "bg-transparent border-white/8 text-white/40 hover:text-white/70 hover:border-white/15"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f}
                    {f === "Pendente" && pendentes > 0 && (
                      <span className="ml-1.5 bg-orange-500/30 text-orange-300 rounded-full px-1.5 text-[10px]">{pendentes}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Botão "Limpar lista" — aparece sempre que há itens na lista */}
              {lista.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all shrink-0 font-bold uppercase tracking-tight"
                  onClick={limparHistorico}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Limpar Histórico
                </Button>
              )}
            </div>

            {/* Lista */}
            {carregando ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
              </div>
            ) : lista.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/2 h-40 flex flex-col items-center justify-center gap-2">
                <Printer className="h-8 w-8 text-white/15" />
                <p className="text-sm text-white/30">Nenhum pedido {filtro !== "todos" ? filtro.toLowerCase() : ""}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {lista.map(imp => (
                    <CardImpressao
                      key={imp.id}
                      imp={imp}
                      isAdmin={isAdmin}
                      onAtualizar={atualizar}
                      onImprimirAgora={imprimirAgora}
                      onDeletar={deletar}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Modal de Histórico Geral (Master) ── */}
      <AnimatePresence>
        {showHistorico && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistorico(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-violet-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <History className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Histórico Geral de Impressões</h2>
                    <p className="text-xs text-white/40">Visualização exclusiva para Usuário Master</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowHistorico(false)} className="rounded-full hover:bg-white/5">
                  <X className="h-5 w-5 text-white/40" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {historicoGeral.length === 0 ? (
                  <div className="py-20 text-center text-white/20">
                    <Printer className="h-12 w-12 mx-auto mb-3 opacity-10" />
                    <p>Nenhum registro encontrado no sistema.</p>
                  </div>
                ) : (
                  <div className="border border-white/5 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-[10px] uppercase font-black tracking-widest text-white/40">
                        <tr>
                          <th className="px-4 py-3">Data/Hora</th>
                          <th className="px-4 py-3">Solicitante</th>
                          <th className="px-4 py-3">Documento</th>
                          <th className="px-4 py-3">Cóp.</th>
                          <th className="px-4 py-3">Impressora</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {historicoGeral.map((h) => (
                          <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-white/60">
                              {fmtData(h.dataPedido)} <span className="text-white/30">{fmtHora(h.dataPedido)}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-white/90">{h.professorSolicitante}</td>
                            <td className="px-4 py-3 text-white/60 max-w-[200px] truncate">{h.nomeArquivo || "—"}</td>
                            <td className="px-4 py-3 font-black text-violet-400">{h.quantidadeCopias}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${h.impressoraNome === "RICOH" ? "bg-slate-500/10 border-slate-500/30 text-slate-300" : "bg-sky-500/10 border-sky-500/30 text-sky-300"}`}>
                                {h.impressoraNome || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-[10px] font-bold ${statusConfig(h.status).cor.split(" ")[0]}`}>
                                {h.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/20 flex justify-between items-center">
                <span className="text-xs text-white/30">{historicoGeral.length} registros no total</span>
                <Button 
                  onClick={limparHistorico}
                  variant="ghost" 
                  className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-xs h-8"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Limpar Histórico Permanente
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

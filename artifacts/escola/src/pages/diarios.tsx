// @ts-nocheck
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen, Users, Sun, Sunset, Loader2, ChevronRight,
  GraduationCap, RefreshCcw, Check, Clock, XCircle,
  FileText, Printer, Share2, Download, Copy, CalendarDays,
  ChevronDown, AlertCircle, Send
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import html2pdf from "html2pdf.js";
import { useSyncGlobal } from "@/contexts/SyncContext";
import { WhatsAppSendModal } from "@/components/WhatsAppSendModal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TurmaInfo {
  id: number;
  nomeTurma: string;
  turno: string;
  professorResponsavel: string | null;
  cor: string;
  totalAlunos: number;
}

function contrastColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

function lightenColor(hex: string, amount = 50): string {
  const clean = hex.replace("#", "");
  const r = Math.min(255, parseInt(clean.substring(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(clean.substring(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(clean.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darkenColor(hex: string, amount = 55): string {
  const clean = hex.replace("#", "");
  const r = Math.max(0, parseInt(clean.substring(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(clean.substring(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(clean.substring(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function DiariosPage() {
  const { data: turmas, isLoading } = useQuery<TurmaInfo[]>({
    queryKey: ["diario-turmas"],
    queryFn: () =>
      fetch(`${BASE}/api/diario/turmas`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: linksMeta } = useQuery({
    queryKey: ["diario-links-meta"],
    queryFn: () =>
      fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" }).then((r) => r.json()),
  });

  const { fase, progresso, ultimaSyncGlob, relatorio, iniciarSincronizacaoGlobal } = useSyncGlobal();
  const ultimaSync = ultimaSyncGlob;

  // States for report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportTurmaMode, setReportTurmaMode] = useState<"all" | "custom">("all");
  const [selectedTurmasReport, setSelectedTurmasReport] = useState<Set<string>>(new Set());
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);
  const [copiandoLink, setCopiandoLink] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const getReportUrl = () => {
    let url = `${window.location.origin}${BASE}/api/diario/relatorio-frequencia-mensal?mes=${reportMonth}&ano=${reportYear}`;
    if (reportTurmaMode === "custom") {
      const selectedList = Array.from(selectedTurmasReport);
      if (selectedList.length > 0) {
        url += `&turma=${encodeURIComponent(selectedList.join(","))}`;
      }
    }
    return url;
  };

  const handleCopyLink = async () => {
    const url = getReportUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiandoLink(true);
      toast({
        title: "Link Copiado!",
        description: "O link de acesso ao relatório foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopiandoLink(false), 2000);
    } catch (err) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive"
      });
    }
  };

  const handlePrintRicoh = async () => {
    setImprimindoRicoh(true);
    try {
      const url = getReportUrl();
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Erro ao obter o HTML do relatório");
      const html = await resp.text();
      
      const container = document.createElement("div");
      container.innerHTML = html;
      
      const filename = `Relatorio_Frequencia_${reportMonth}_${reportYear}.pdf`;
      const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      const form = new FormData();
      form.append("professorSolicitante", "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const printResp = await fetch(`${BASE}/api/impressoes`, { method: "POST", body: form });
      if (!printResp.ok) throw new Error("Erro ao enviar para a fila de impressão");

      toast({
        title: "Sucesso!",
        description: "Relatório enviado para a fila de impressão da RICOH.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro de Impressão",
        description: "Não foi possível enviar para a RICOH. O relatório será aberto em uma nova aba.",
        variant: "destructive"
      });
      // Abrir em nova aba em caso de falha
      window.open(getReportUrl(), "_blank");
    } finally {
      setImprimindoRicoh(false);
    }
  };

  const handleSendWhatsApp = async (numero: string, mensagem: string) => {
    try {
      const url = getReportUrl();
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Erro ao obter o HTML do relatório");
      const html = await resp.text();
      
      const container = document.createElement("div");
      container.innerHTML = html;
      
      const filename = `Relatorio_Frequencia_${reportMonth}_${reportYear}.pdf`;
      const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      const form = new FormData();
      form.append("numero", numero);
      form.append("mensagem", mensagem);
      form.append("arquivo", file);

      const sendResp = await fetch(`${BASE}/api/whatsapp/send-document`, { method: "POST", body: form });
      const data = await sendResp.json();
      if (!sendResp.ok) throw new Error(data.error || "Erro ao enviar via WhatsApp");
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  const iniciarSincronizacao = iniciarSincronizacaoGlobal;

  const lista = Array.isArray(turmas) ? turmas : [];
  const manha = lista.filter((t) => t.turno?.toLowerCase().includes("man"));
  const tarde = lista.filter((t) => t.turno?.toLowerCase().includes("tar"));
  const outros = lista.filter((t) => !t.turno?.toLowerCase().includes("man") && !t.turno?.toLowerCase().includes("tar"));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </AppLayout>
    );
  }

  const pct = progresso.total > 0 ? Math.round((progresso.atual / progresso.total) * 100) : 0;

  return (
    <AppLayout>
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Banner de Progresso Geral (Sincronização Ativa) */}
      {fase === "baixando" && (
        <div className="mb-6 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Sincronizando com o SUAP...</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Baixando diários e atualizando presenças no sistema.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-400">{pct}%</span>
              <p className="text-xs text-gray-500 mt-0.5">Sincronizando {progresso.atual + 1} de {progresso.total}</p>
            </div>
          </div>
          
          {/* Barra de progresso */}
          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-3">
            <div 
              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
              style={{ width: `${pct}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-amber-400/90 truncate max-w-[70%]">
              Turma atual: <span className="text-white font-bold">{progresso.turmaAtual}</span>
            </span>
            <span className="text-gray-400 shrink-0">{progresso.msg}</span>
          </div>
        </div>
      )}

      {/* Cabeçalho com botão "Atualizar todos" */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-blue-500/20">
          <BookOpen className="w-6 h-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Diários de Classe</h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Controle de frequência por turma</span>
            {ultimaSync && fase !== "baixando" && (
              <>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  Atualizado: {formatarDataHora(ultimaSync)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Ações do Cabeçalho */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-blue-500/20 text-blue-300 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30"
          >
            <FileText className="w-4.5 h-4.5" />
            Relatório de Frequência
          </button>

          {/* Botão 3 estados */}
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={iniciarSincronizacao}
              disabled={fase === "baixando"}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border overflow-hidden ${
                fase === "baixando"
                  ? "border-amber-400/50 text-amber-300 cursor-wait"
                  : fase === "done"
                  ? "border-emerald-400/50 text-emerald-300 hover:opacity-90"
                  : "border-blue-500/40 text-blue-300 hover:opacity-90"
              }`}
              style={{
                background: fase === "baixando"
                  ? "rgba(245,158,11,0.15)"
                  : fase === "done"
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(59,130,246,0.15)",
              }}
            >
              {/* Barra de progresso animada (amarelo) */}
              {fase === "baixando" && (
                <span className="absolute inset-0 overflow-hidden rounded-xl">
                  <span
                    className="absolute inset-y-0 left-0 bg-amber-400/20 transition-all duration-700"
                    style={{ width: `${pct || 15}%` }}
                  />
                </span>
              )}
              <span className="relative flex items-center gap-2">
                {fase === "baixando" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {progresso.turmaAtual ? progresso.turmaAtual : (progresso.atual > 0 ? `${progresso.atual}/${progresso.total}` : "...")}</>
                ) : fase === "done" ? (
                  <><Check className="w-4 h-4" /> Sincronizado</>
                ) : (
                  <><RefreshCcw className="w-4 h-4" /> Sincronizar Tudo</>
                )}
              </span>
            </button>
            {fase === "baixando" && progresso.msg && (
              <span className="text-xs font-semibold text-amber-400/80 max-w-[200px] text-right truncate">{progresso.msg}</span>
            )}
            {fase === "done" && (
              <span className="text-xs font-semibold text-emerald-400/80">{progresso.msg}</span>
            )}
          </div>
        </div>
      </div>

      {manha.length > 0 && (
        <Section titulo="Turno da Manhã" icon={<Sun className="w-4 h-4" />} turmas={manha} linksMeta={linksMeta} />
      )}
      {tarde.length > 0 && (
        <Section titulo="Turno da Tarde" icon={<Sunset className="w-4 h-4" />} turmas={tarde} linksMeta={linksMeta} />
      )}
      {outros.length > 0 && (
        <Section titulo="Outros Turnos" icon={<GraduationCap className="w-4 h-4" />} turmas={outros} linksMeta={linksMeta} />
      )}

      {turmas?.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma turma cadastrada</p>
        </div>
      )}

      {/* ── Relatório de sincronização ── */}
      {relatorio && fase === "done" && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Relatório da última sincronização</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {relatorio.resultados.map(r => (
              <div key={r.turma} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium border ${
                r.erro
                  ? "bg-red-950/40 border-red-700/30 text-red-300"
                  : "bg-emerald-950/40 border-emerald-700/30 text-emerald-300"
              }`}>
                {r.erro
                  ? <XCircle className="w-3.5 h-3.5 shrink-0" />
                  : <Check className="w-3.5 h-3.5 shrink-0" />
                }
                <span className="font-bold">{r.turma}</span>
                {r.erro
                  ? <span className="truncate opacity-70" title={r.erro}>Erro</span>
                  : <span className="opacity-70">{r.aulas} aulas · {r.presencas} presenças</span>
                }
              </div>
            ))}
          </div>
          {relatorio.turmasSemLink.length > 0 && (
            <div className="px-5 py-3 border-t border-white/10">
              <p className="text-xs text-amber-400/80 font-medium mb-2">Turmas sem link cadastrado (não sincronizadas):</p>
              <div className="flex flex-wrap gap-1.5">
                {relatorio.turmasSemLink.map(t => (
                  <span key={t} className="text-xs bg-amber-950/40 border border-amber-700/30 text-amber-300 rounded-lg px-2 py-1">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── Dialog do Relatório de Frequência ── */}
    <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
      <DialogContent className="max-w-md bg-[#0f172a] border-white/10 text-white rounded-2xl p-6 shadow-2xl shadow-black/80">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
            <FileText className="w-5 h-5 text-blue-400" />
            Relatório de Frequência Mensal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Período de Referência */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
              Período de Referência
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Seleção do Mês */}
              <div className="relative">
                <select
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white cursor-pointer focus:outline-none focus:border-blue-500 appearance-none pr-8"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {[
                    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                  ].map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-[#0f172a]">
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>

              {/* Seleção do Ano */}
              <div className="relative">
                <select
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white cursor-pointer focus:outline-none focus:border-blue-500 appearance-none pr-8"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y} className="bg-[#0f172a]">
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Seleção de Turmas */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Filtro de Turmas
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="turmaMode"
                  checked={reportTurmaMode === "all"}
                  onChange={() => setReportTurmaMode("all")}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span>Todas as turmas</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="turmaMode"
                  checked={reportTurmaMode === "custom"}
                  onChange={() => setReportTurmaMode("custom")}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span>Selecionar uma por uma</span>
              </label>
            </div>

            {/* Lista de Checkboxes de Turmas */}
            {reportTurmaMode === "custom" && (
              <div className="border border-white/10 rounded-xl p-3 bg-white/5 max-h-40 overflow-y-auto space-y-2 mt-2">
                {turmas && turmas.length > 0 ? (
                  turmas.map((t) => {
                    const isChecked = selectedTurmasReport.has(t.nomeTurma);
                    return (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 text-sm cursor-pointer py-1 hover:bg-white/5 px-2 rounded-lg transition-colors"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setSelectedTurmasReport((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(t.nomeTurma);
                              } else {
                                next.delete(t.nomeTurma);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="font-semibold text-white">{t.nomeTurma}</span>
                        <span className="text-xs text-white/40 font-normal">({t.turno})</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-500 italic">Nenhuma turma cadastrada</p>
                )}
              </div>
            )}
          </div>

          {/* Aviso informativo de 75% */}
          <div className="flex items-start gap-2 p-3 bg-blue-950/20 border border-blue-800/20 rounded-xl">
            <AlertCircle className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300">
              O relatório mostrará automaticamente alunos com frequência <strong className="text-white">menor do que 75%</strong> (reprovados por falta e em situação crítica de risco).
            </p>
          </div>

          {/* Ações do Modal */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
            <button
              disabled={reportTurmaMode === "custom" && selectedTurmasReport.size === 0}
              onClick={() => {
                window.open(getReportUrl(), "_blank");
                setShowReportModal(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-blue-600/20 animate-in fade-in"
            >
              <Download className="w-4 h-4" />
              Visualizar / Baixar PDF
            </button>

            <div className="flex gap-2">
              <button
                disabled={reportTurmaMode === "custom" && selectedTurmasReport.size === 0}
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition-all"
              >
                {copiandoLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiandoLink ? "Copiado!" : "Copiar Link"}
              </button>
              <button
                disabled={(reportTurmaMode === "custom" && selectedTurmasReport.size === 0)}
                onClick={() => setShowWhatsAppModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 transition-all disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                disabled={(reportTurmaMode === "custom" && selectedTurmasReport.size === 0) || imprimindoRicoh}
                onClick={handlePrintRicoh}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white border border-white/10 transition-all active:scale-95 disabled:bg-slate-800/40 disabled:border-white/5 disabled:text-white/20"
              >
                {imprimindoRicoh ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                RICOH
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <WhatsAppSendModal 
      open={showWhatsAppModal} 
      onOpenChange={setShowWhatsAppModal} 
      onSend={handleSendWhatsApp} 
    />
    </AppLayout>
  );
}

function Section({ titulo, icon, turmas, linksMeta }: { titulo: string; icon: React.ReactNode; turmas: TurmaInfo[]; linksMeta: any }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{titulo}</h2>
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-500">{turmas.length} turmas</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {turmas.map((t) => {
          const syncInfo = linksMeta?.links?.find(
            (l: any) => l.turma?.toUpperCase() === t.nomeTurma.toUpperCase()
          );
          return <TurmaCard key={t.id} turma={t} ultimaSync={syncInfo?.ultimaSync} />;
        })}
      </div>
    </div>
  );
}

function TurmaCard({ turma, ultimaSync }: { turma: TurmaInfo; ultimaSync?: string | null }) {
  const cor = turma.cor || "#3b82f6";
  const textColor = contrastColor(cor);
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  return (
    <Link href={`/diarios/${encodeURIComponent(turma.nomeTurma)}/${ano}/${mes}`}>
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-white/10"
        style={{
          background: `radial-gradient(ellipse at 28% 22%, ${lightenColor(cor, 55)} 0%, ${cor} 45%, ${darkenColor(cor, 65)} 100%)`,
          boxShadow: `0 8px 32px ${cor}55, inset 0 1px 0 ${lightenColor(cor, 80)}44`,
        }}
      >
        {/* Header */}
        <div className="p-5" style={{ color: textColor }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-2xl font-black tracking-tight">{turma.nomeTurma}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{turma.turno}</div>
            </div>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:translate-x-1"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div
              className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1"
              style={{ background: "rgba(0,0,0,0.18)" }}
            >
              <Users className="w-3 h-3" />
              <span>{turma.totalAlunos} alunos</span>
            </div>
            
            {ultimaSync && (
              <div 
                className={cn(
                  "flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5",
                  (Date.now() - new Date(ultimaSync).getTime() > 5 * 24 * 60 * 60 * 1000)
                    ? "bg-red-500/80 text-white font-bold animate-pulse"
                    : "opacity-60"
                )}
              >
                {(Date.now() - new Date(ultimaSync).getTime() > 5 * 24 * 60 * 60 * 1000) ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-2.5 h-2.5" />
                )}
                {new Date(ultimaSync).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 text-xs truncate"
          style={{ background: "rgba(0,0,0,0.20)", color: textColor, opacity: 0.9 }}
        >
          {turma.professorResponsavel ? (
            <span className="font-medium">{turma.professorResponsavel}</span>
          ) : (
            <span className="italic opacity-50">Sem professor cadastrado</span>
          )}
        </div>

        {/* Hover overlay sutil */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    </Link>
  );
}

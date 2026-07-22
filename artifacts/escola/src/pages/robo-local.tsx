// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMe } from "@workspace/api-client-react";
import {
  Bot, Play, Settings, Check, XCircle, Loader2, Clock,
  CalendarDays, Cpu, Wifi, WifiOff, Zap, RefreshCcw,
  Trash2, Plus, Save, Power, BookOpen, Users,
  History, CheckCircle2, AlertTriangle, Info, Search, Filter, FileText,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ─── Utilitários ──────────────────────────────────────────────────────── */
function fmt(isoOrStr: string | null | undefined): string {
  if (!isoOrStr) return "—";
  return isoOrStr;
}

/* ─── Badge de status ──────────────────────────────────────────────────── */
function StatusBadge({ online }: { online: boolean | null }) {
  if (online === null)
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-sm font-medium">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verificando...
      </div>
    );
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wide transition-all ${
        online
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : "bg-red-500/10 border-red-500/30 text-red-400"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
      />
      {online ? "Robô Online" : "Robô Offline"}
    </div>
  );
}

/* ─── Mapeamento de Cores para Tailwind ────────────────────────────────── */
const COR_MAP: Record<string, { bg: string; text: string; textLight: string; border: string; borderStrong: string; bgActive: string; toggle: string }> = {
  emerald: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    textLight: "text-emerald-300",
    border: "border-emerald-500/30",
    borderStrong: "border-emerald-500/40",
    bgActive: "bg-emerald-500/20",
    toggle: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    textLight: "text-blue-300",
    border: "border-blue-500/30",
    borderStrong: "border-blue-500/40",
    bgActive: "bg-blue-500/20",
    toggle: "bg-blue-500",
  },
};

/* ─── Card de resultado da última sync ────────────────────────────────── */
function UltimoResultado({
  titulo, icone: Icone, cor, dado, sincronizando,
}: {
  titulo: string;
  icone: any;
  cor: "emerald" | "blue";
  dado: { hora: string; resultado: string; ok: boolean } | null;
  sincronizando: boolean;
}) {
  const cmap = COR_MAP[cor] || COR_MAP.blue;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${cmap.bg}`}>
          <Icone className={`h-4 w-4 ${cmap.text}`} />
        </div>
        <span className="text-sm font-semibold text-white">{titulo}</span>
        {sincronizando && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando...
          </span>
        )}
      </div>
      {!dado ? (
        <p className="text-xs text-slate-500">Nenhuma execução registrada.</p>
      ) : (
        <div className="flex items-start gap-3">
          {dado.ok ? (
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${dado.ok ? "text-emerald-300" : "text-red-300"}`}>
              {dado.resultado}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
              {dado.hora}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Editor de horários ───────────────────────────────────────────────── */
function HorarioEditor({
  label, icone: Icone, cor, horarios, ativo,
  onChangeAtivo, onChangeHorarios,
}: {
  label: string; icone: any; cor: "emerald" | "blue";
  horarios: any[]; ativo: boolean;
  onChangeAtivo: (v: boolean) => void;
  onChangeHorarios: (h: any[]) => void;
}) {
  const cmap = COR_MAP[cor] || COR_MAP.blue;

  function addHorario() {
    onChangeHorarios([...horarios, { hora: 6, minuto: 0, dias_semana: [0, 1, 2, 3, 4] }]);
  }
  function removeHorario(i: number) {
    onChangeHorarios(horarios.filter((_, idx) => idx !== i));
  }
  function updateHorario(i: number, field: string, val: any) {
    const updated = horarios.map((h, idx) => idx === i ? { ...h, [field]: val } : h);
    onChangeHorarios(updated);
  }
  function toggleDia(i: number, dia: number) {
    const h = horarios[i];
    const dias = h.dias_semana.includes(dia)
      ? h.dias_semana.filter((d: number) => d !== dia)
      : [...h.dias_semana, dia].sort();
    updateHorario(i, "dias_semana", dias);
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${cmap.bg}`}>
            <Icone className={`h-4 w-4 ${cmap.text}`} />
          </div>
          <span className="text-sm font-bold text-white">{label}</span>
        </div>
        <button
          onClick={() => onChangeAtivo(!ativo)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            ativo ? cmap.toggle : "bg-white/10"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              ativo ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {!ativo && (
        <p className="text-xs text-slate-500">Agendamento desativado. Ative para configurar horários.</p>
      )}

      {ativo && (
        <>
          {horarios.length === 0 && (
            <p className="text-xs text-slate-500">Nenhum horário configurado. Clique em "+ Adicionar horário".</p>
          )}

          {horarios.map((h, i) => (
            <div key={i} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400">Hora</label>
                  <input
                    type="number" min={0} max={23}
                    value={h.hora}
                    onChange={e => updateHorario(i, "hora", Math.min(23, Math.max(0, +e.target.value)))}
                    className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-white/30"
                  />
                </div>
                <span className="text-white/40 text-lg">:</span>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-slate-400">Min</label>
                  <input
                    type="number" min={0} max={59}
                    value={h.minuto}
                    onChange={e => updateHorario(i, "minuto", Math.min(59, Math.max(0, +e.target.value)))}
                    className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-white/30"
                  />
                </div>
                <button
                  onClick={() => removeHorario(i)}
                  className="ml-auto p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((dia, dIdx) => (
                  <button
                    key={dIdx}
                    onClick={() => toggleDia(i, dIdx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      h.dias_semana.includes(dIdx)
                        ? `${cmap.bgActive} ${cmap.textLight} border ${cmap.borderStrong}`
                        : "bg-white/5 text-slate-500 border border-white/5 hover:border-white/20"
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={addHorario}
            className="flex items-center gap-2 justify-center px-4 py-2 rounded-xl border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-white/40 text-sm transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar horário
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Próximas execuções ───────────────────────────────────────────────── */
function ProximasExecucoes({ lista }: { lista: any[] }) {
  if (!lista || lista.length === 0) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Próximas Execuções Agendadas</span>
      </div>
      <div className="space-y-2">
        {lista.map((ex: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {ex.tipo === "diarios"
                ? <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                : <Users className="h-3.5 w-3.5 text-blue-400" />
              }
              <span className="text-slate-300">
                {ex.tipo === "diarios" ? "Diários" : "Alunos"}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {ex.dia} às {ex.hora}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Histórico de Atualizações / Log ──────────────────────────────────── */
function HistoricoAtualizacoes({
  logs,
  loading,
  onRefresh,
  onClear,
}: {
  logs: any[];
  loading: boolean;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    if (!confirm("Deseja realmente limpar todo o histórico de atualizações?")) return;
    setClearing(true);
    await onClear();
    setClearing(false);
  }

  // Filtragem dos registros
  const filtered = logs.filter((item) => {
    if (filterStatus === "sucesso" && item.status !== "sucesso") return false;
    if (filterStatus === "erro" && item.status !== "erro") return false;
    if (filterStatus === "info" && item.status !== "info" && item.status !== "em_andamento") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ev = (item.evento || "").toLowerCase();
      const det = (item.detalhes || "").toLowerCase();
      const tp = (item.tipo || "").toLowerCase();
      const dh = (item.dataHora || "").toLowerCase();
      return ev.includes(q) || det.includes(q) || tp.includes(q) || dh.includes(q);
    }
    return true;
  });

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-xl backdrop-blur-md">
      {/* Topo do Log */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Histórico de Atualizações</h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-slate-300">
                {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Log detalhado das sincronizações, status de erros e comandos executados pelo Robô Escolar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Atualizar Logs"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium text-red-300 transition-all disabled:opacity-50"
              title="Limpar Histórico"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar Log
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Input de Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por evento, erro, turma ou data..."
            className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>

        {/* Abas de Filtro de Status */}
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
          {[
            { id: "todos", label: "Todos" },
            { id: "sucesso", label: "Sem Erros" },
            { id: "erro", label: "Com Erros" },
            { id: "info", label: "Informações" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filterStatus === tab.id
                  ? "bg-white/10 text-white shadow-sm font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Registros */}
      {loading && logs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          Carregando histórico de atualizações...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs bg-black/20 rounded-xl border border-white/5 space-y-1">
          <FileText className="h-6 w-6 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="font-semibold text-slate-300">Nenhum registro encontrado</p>
          <p className="text-slate-500">
            {searchQuery || filterStatus !== "todos"
              ? "Tente ajustar a busca ou o filtro de status."
              : "Nenhuma atualização foi registrada no histórico ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filtered.map((item, idx) => {
            const isSucesso = item.status === "sucesso";
            const isErro = item.status === "erro";
            const isInfo = item.status === "info" || item.status === "em_andamento";

            let TipoIcon = Cpu;
            let tipoLabel = "Robô";
            let tipoBadgeClass = "bg-purple-500/10 text-purple-300 border-purple-500/20";

            if (item.tipo === "diarios") {
              TipoIcon = BookOpen;
              tipoLabel = "Diários";
              tipoBadgeClass = "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
            } else if (item.tipo === "alunos") {
              TipoIcon = Users;
              tipoLabel = "Alunos";
              tipoBadgeClass = "bg-blue-500/10 text-blue-300 border-blue-500/20";
            } else if (item.tipo === "agenda") {
              TipoIcon = Settings;
              tipoLabel = "Agenda";
              tipoBadgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/20";
            }

            return (
              <div
                key={item.id || idx}
                className={`p-4 rounded-xl border transition-all ${
                  isErro
                    ? "bg-red-500/5 border-red-500/20 hover:border-red-500/30"
                    : isSucesso
                    ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5">
                    {/* Icone de Status */}
                    {isSucesso && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />}
                    {isErro && <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />}
                    {isInfo && <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 sm:mt-0" />}

                    {/* Título do Evento */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{item.evento}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${tipoBadgeClass}`}>
                        <TipoIcon className="h-3 w-3" />
                        {tipoLabel}
                      </span>
                    </div>
                  </div>

                  {/* Badges de Status & Timestamp */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {item.dataHora}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isSucesso
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : isErro
                          ? "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      }`}
                    >
                      {isSucesso ? "Sem Erros" : isErro ? "Com Erro" : "Informação"}
                    </span>
                  </div>
                </div>

                {/* Detalhes / Diagnóstico de erro */}
                {item.detalhes && (
                  <div className="mt-2.5 pt-2 border-t border-white/5 text-xs">
                    <p className={`font-sans leading-relaxed ${isErro ? "text-red-300/90 font-medium" : "text-slate-300"}`}>
                      {item.detalhes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Página principal ─────────────────────────────────────────────────── */
export default function RoboLocalPage() {
  const { data: me } = useGetMe();

  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [syncingDiarios, setSyncingDiarios] = useState(false);
  const [syncingAlunos, setSyncingAlunos]   = useState(false);
  const [hasLoadedConfig, setHasLoadedConfig] = useState(false);

  // ── Busca status e config unificados da API central ────────────────────
  const loadData = useCallback(async (showLoading = false, forceConfig = false) => {
    if (showLoading) setLoadingConfig(true);
    try {
      const r = await fetch(`${BASE}/api/robo/status`, {
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok) {
        setOnline(res.online);
        setStatus(res.status || null);
        if (res.logs && Array.isArray(res.logs)) {
          setLogs(res.logs);
        }
        // Só sobrescreve a config local se ainda não foi carregada OU se for explicitamente forçado
        if ((!hasLoadedConfig || forceConfig) && !salvando) {
          setConfig(res.config || {
            diarios: { ativo: false, horarios: [] },
            alunos:  { ativo: false, horarios: [] },
          });
          setHasLoadedConfig(true);
        }
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    } finally {
      if (showLoading) setLoadingConfig(false);
    }
  }, [salvando, hasLoadedConfig]);

  // ── Polling mais leve apenas de status e logs ──
  const loadStatusOnly = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/robo/status`, {
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok) {
        setOnline(res.online);
        setStatus(res.status || null);
        if (res.logs && Array.isArray(res.logs)) {
          setLogs(res.logs);
        }
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    }
  }, []);

  const loadLogsOnly = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const r = await fetch(`${BASE}/api/robo/logs`, {
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok && Array.isArray(res.logs)) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.error("Erro ao buscar logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/robo/logs`, {
        method: "DELETE",
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok) {
        setLogs([]);
      } else {
        alert("Erro ao limpar histórico: " + res.error);
      }
    } catch (e) {
      alert("Erro de conexão ao limpar histórico: " + e);
    }
  }, []);

  // ── Polling inicial e recorrente ───────────────────────────────────────
  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalTime = syncingDiarios || syncingAlunos || status?.sincronizando_diarios || status?.sincronizando_alunos ? 2000 : 5000;
    const t = setInterval(() => loadStatusOnly(), intervalTime);
    return () => clearInterval(t);
  }, [loadStatusOnly, syncingDiarios, syncingAlunos, status?.sincronizando_diarios, status?.sincronizando_alunos]);

  // ── Salvar config ──────────────────────────────────────────────────────
  async function salvarConfig() {
    if (!config) return;
    setSalvando(true);
    setSavedOk(false);
    try {
      const r = await fetch(`${BASE}/api/robo/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok) {
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 3000);
        // Força sincronização de volta
        loadData(false, true);
      } else {
        alert("Erro ao salvar configuração: " + res.mensagem);
      }
    } catch (e) {
      alert("Erro de conexão ao salvar configuração: " + e);
    } finally {
      setSalvando(false);
    }
  }

  // ── Sync manual ────────────────────────────────────────────────────────
  async function acionar(tipo: "diarios" | "alunos") {
    const setter = tipo === "diarios" ? setSyncingDiarios : setSyncingAlunos;
    setter(true);
    try {
      const r = await fetch(`${BASE}/api/robo/sync/${tipo}`, {
        method: "POST",
        credentials: "include",
      });
      const res = await r.json();
      if (!res.ok) {
        alert(`Erro ao acionar sync de ${tipo}: ${res.mensagem}`);
      } else {
        // Força recarga imediata
        loadData(false);
      }
    } catch (e) {
      alert(`Erro de conexão ao acionar sync de ${tipo}: ${e}`);
    } finally {
      setTimeout(() => setter(false), 3000);
    }
  }

  const isSyncingDiarios = syncingDiarios || status?.sincronizando_diarios;
  const isSyncingAlunos  = syncingAlunos  || status?.sincronizando_alunos;

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/10 border border-violet-500/20">
              <Bot className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Robô Escolar</h1>
              <p className="text-sm text-slate-400 mt-0.5">Sincronização automática centralizada de diários e alunos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge online={online} />
            <button
              onClick={() => loadData(true, true)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              title="Atualizar status"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Aviso offline ─────────────────────────────────────────────── */}
        {online === false && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10 shrink-0">
              <WifiOff className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-orange-300 mb-1">Robô local desconectado</h2>
              <p className="text-sm text-orange-200/60">
                O Robô só funcionará se o computador da escola estiver ligado e com o processo do robô ativo.
                Se o computador estiver ligado, o robô se conectará automaticamente em instantes.
              </p>
            </div>
          </div>
        )}

        {/* ── Status de progresso atual ──────────────────────────────────── */}
        {(isSyncingDiarios || isSyncingAlunos) && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">Sincronização Ativa em Andamento</h3>
                <p className="text-xs text-slate-400">O robô local no computador da escola está processando as informações...</p>
              </div>
            </div>

            {/* Progresso de Diários */}
            {isSyncingDiarios && (() => {
              const prog = status?.progresso_diarios;
              const atual = prog?.atual ?? 0;
              const total = prog?.total ?? 0;
              const msg = prog?.msg ?? "Iniciando download dos diários...";
              const pct = total > 0 ? Math.round((atual / total) * 100) : 0;
              return (
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {msg}
                    </span>
                    <span className="text-slate-300">{atual}/{total} ({pct}%)</span>
                  </div>
                  {/* Trilho e Barra */}
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Progresso de Alunos */}
            {isSyncingAlunos && (() => {
              const prog = status?.progresso_alunos;
              const atual = prog?.atual ?? 0;
              const total = prog?.total ?? 1;
              const msg = prog?.msg ?? "Verificando lista de alunos no SUAP...";
              const pct = total > 0 ? Math.round((atual / total) * 100) : 0;
              return (
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-blue-400 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {msg}
                    </span>
                    <span className="text-slate-300">{pct}%</span>
                  </div>
                  {/* Trilho e Barra */}
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Últimos resultados ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UltimoResultado
            titulo="Última Sync de Diários"
            icone={BookOpen}
            cor="emerald"
            dado={status?.ultimo_diarios}
            sincronizando={isSyncingDiarios}
          />
          <UltimoResultado
            titulo="Última Sync de Alunos"
            icone={Users}
            cor="blue"
            dado={status?.ultimo_alunos}
            sincronizando={isSyncingAlunos}
          />
        </div>

        {/* ── Próximas execuções ────────────────────────────────────── */}
        {status?.proximas_execucoes?.length > 0 && (
          <ProximasExecucoes lista={status.proximas_execucoes} />
        )}

        {/* ── Ações manuais ─────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Executar Agora de forma Remota</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Clique para enviar um comando instantâneo para o robô da escola. O robô identificará e iniciará a tarefa em até 10 segundos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Botão Diários */}
            <button
              onClick={() => acionar("diarios")}
              disabled={isSyncingDiarios || !online}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSyncingDiarios ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 group-hover:scale-110 transition-transform" />
              )}
              {isSyncingDiarios ? "Solicitado..." : "▶ Sincronizar Diários Agora"}
            </button>

            {/* Botão Alunos */}
            <button
              onClick={() => acionar("alunos")}
              disabled={isSyncingAlunos || !online}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 font-semibold hover:bg-blue-500/20 hover:border-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isSyncingAlunos ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 group-hover:scale-110 transition-transform" />
              )}
              {isSyncingAlunos ? "Solicitado..." : "▶ Sincronizar Alunos Agora"}
            </button>
          </div>
        </div>

        {/* ── Configuração de Agenda ─────────────────────────────────────── */}
        {config && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-bold text-white">Configuração de Agenda Remota</span>
            </div>

            {loadingConfig ? (
              <div className="flex items-center gap-2 text-slate-500 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando agenda...</span>
              </div>
            ) : (
              <>
                {/* Editor Diários */}
                <HorarioEditor
                  label="Sincronização de Diários"
                  icone={BookOpen}
                  cor="emerald"
                  ativo={config.diarios?.ativo ?? false}
                  horarios={config.diarios?.horarios ?? []}
                  onChangeAtivo={v => setConfig((c: any) => ({ ...c, diarios: { ...c.diarios, ativo: v } }))}
                  onChangeHorarios={h => setConfig((c: any) => ({ ...c, diarios: { ...c.diarios, horarios: h } }))}
                />

                {/* Editor Alunos */}
                <HorarioEditor
                  label="Sincronização de Alunos"
                  icone={Users}
                  cor="blue"
                  ativo={config.alunos?.ativo ?? false}
                  horarios={config.alunos?.horarios ?? []}
                  onChangeAtivo={v => setConfig((c: any) => ({ ...c, alunos: { ...c.alunos, ativo: v } }))}
                  onChangeHorarios={h => setConfig((c: any) => ({ ...c, alunos: { ...c.alunos, horarios: h } }))}
                />

                {/* Salvar */}
                <button
                  onClick={salvarConfig}
                  disabled={salvando}
                  className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                    savedOk
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                      : "bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20"
                  } disabled:opacity-50`}
                >
                  {salvando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedOk ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {salvando ? "Salvando na Nuvem..." : savedOk ? "Agenda Atualizada!" : "Salvar Agenda na Nuvem"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Histórico de Atualizações / Log ─────────────────────────────── */}
        <HistoricoAtualizacoes
          logs={logs}
          loading={loadingLogs}
          onRefresh={loadLogsOnly}
          onClear={clearLogs}
        />

        {/* ── Rodapé informativo ────────────────────────────────────────── */}
        <div className="bg-white/3 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
          <Cpu className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 space-y-1">
            <p><span className="text-slate-400 font-semibold">Robô Escolar Conectado via Nuvem</span></p>
            <p>O robô instalado no computador da escola envia atualizações de status e busca comandos pendentes automaticamente.</p>
            <p>Os horários configurados usam o fuso horário local da escola.</p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

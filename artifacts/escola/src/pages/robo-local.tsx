// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMe } from "@workspace/api-client-react";
import {
  Bot, Play, Settings, Check, XCircle, Loader2, Clock,
  CalendarDays, Cpu, Wifi, WifiOff, Zap, RefreshCcw,
  Trash2, Plus, Save, Power, BookOpen, Users,
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

/* ─── Página principal ─────────────────────────────────────────────────── */
export default function RoboLocalPage() {
  const { data: me } = useGetMe();

  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [syncingDiarios, setSyncingDiarios] = useState(false);
  const [syncingAlunos, setSyncingAlunos]   = useState(false);

  // ── Busca status e config unificados da API central ────────────────────
  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingConfig(true);
    try {
      const r = await fetch(`${BASE}/api/robo/status`, {
        credentials: "include",
      });
      const res = await r.json();
      if (res.ok) {
        setOnline(res.online);
        setStatus(res.status || null);
        // Só sobrescreve a config local se não estiver salvando no momento
        if (!salvando) {
          setConfig(res.config || {
            diarios: { ativo: false, horarios: [] },
            alunos:  { ativo: false, horarios: [] },
          });
        }
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    } finally {
      if (showLoading) setLoadingConfig(false);
    }
  }, [salvando]);

  // ── Polling inicial e recorrente ───────────────────────────────────────
  useEffect(() => {
    loadData(true);
    const intervalTime = syncingDiarios || syncingAlunos || status?.sincronizando_diarios || status?.sincronizando_alunos ? 2000 : 5000;
    const t = setInterval(() => loadData(false), intervalTime);
    return () => clearInterval(t);
  }, [loadData, syncingDiarios, syncingAlunos, status?.sincronizando_diarios, status?.sincronizando_alunos]);

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
              onClick={() => loadData(true)}
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

        {/* ── Status de sync atual ──────────────────────────────────── */}
        {(isSyncingDiarios || isSyncingAlunos) && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-amber-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Sincronização em andamento no computador da escola</p>
              <p className="text-xs text-amber-200/60 mt-0.5">
                {isSyncingDiarios && "Baixando diários do SUAP..."}
                {isSyncingDiarios && isSyncingAlunos && " • "}
                {isSyncingAlunos && "Sincronizando alunos..."}
              </p>
            </div>
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

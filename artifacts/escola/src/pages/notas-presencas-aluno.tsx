// @ts-nocheck
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetAluno, useListarAlunos, useListarTurmas } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2,
  BookOpen, Activity, TrendingUp, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Calendar, BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const COR_PADRAO = "#3b82f6";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Nota {
  id: number; bimestre: number; disciplina: string;
  nota1: string | null; nota2: string | null;
  notaFinal: string | null; mediaFinal: string | null;
  situacao: string | null;
}
interface Presenca {
  id: number; bimestre: number; disciplina: string;
  totalAulas: number; faltas: number; percentualFrequencia: string | null;
}

interface MesInfo {
  mes: number; nomeMes: string; aulas: number;
  presencas: number; faltas: number; pct: number | null;
}
interface BimestreInfo {
  bimestre: number; aulas: number; presencas: number;
  faltas: number; pct: number | null; meses: MesInfo[];
}
interface DiarioFreq {
  bimestres: Record<number, BimestreInfo>;
  total: { aulas: number; presencas: number; faltas: number; pct: number | null };
}

const BIMESTRE_MESES: Record<number, string> = {
  1: "Fev · Mar",
  2: "Abr · Mai · Jun",
  3: "Ago · Set",
  4: "Out · Nov",
};

function corFreqValor(v: number | null): string {
  if (v === null) return "#64748b";
  if (v >= 75) return "#10b981";
  if (v >= 50) return "#f59e0b";
  return "#ef4444";
}

function corFreqText(v: number | null): string {
  if (v === null) return "text-slate-500";
  if (v >= 75) return "text-emerald-400";
  if (v >= 50) return "text-yellow-400";
  return "text-red-400";
}

function corNota(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  if (v >= 7) return "text-emerald-400";
  if (v >= 5) return "text-yellow-400";
  return "text-red-400";
}

function BimestreTab({ b, ativo, onClick, cor }: { b: number; ativo: boolean; onClick: () => void; cor: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2.5 rounded-xl text-sm font-bold border transition-all duration-200",
        ativo ? "text-white shadow-lg" : "text-muted-foreground border-white/10 bg-white/5 hover:text-white hover:bg-white/10"
      )}
      style={ativo ? { background: cor, borderColor: cor, boxShadow: `0 4px 16px ${cor}44` } : {}}
    >
      {b}º Bimestre
    </button>
  );
}

/* ─── Anel SVG de frequência ─── */
function FreqRing({ pct, cor, size = 72 }: { pct: number | null; cor: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const filled = pct !== null ? (pct / 100) * circ : 0;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={cor}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.6s ease", filter: `drop-shadow(0 0 6px ${cor}88)` }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill={pct !== null ? "#fff" : "#475569"}
        fontSize={pct !== null ? 14 : 10}
        fontWeight="bold"
      >
        {pct !== null ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}

/* ─── Barra de progresso de mês ─── */
function MesBar({ info }: { info: MesInfo }) {
  const cor = corFreqValor(info.pct);
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 text-xs font-bold text-gray-400 shrink-0">{info.nomeMes}</div>
      <div className="flex-1 relative">
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(info.pct ?? 0, 100)}%`, background: cor, boxShadow: `0 0 6px ${cor}66` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-bold" style={{ color: cor }}>{info.pct !== null ? `${info.pct}%` : "—"}</span>
        <span className="text-[10px] text-emerald-400/70">{info.presencas}P</span>
        {info.faltas > 0 && <span className="text-[10px] text-red-400/70">{info.faltas}F</span>}
        <span className="text-[10px] text-gray-600">{info.aulas} dias</span>
      </div>
    </div>
  );
}

/* ─── Card de Bimestre ─── */
function BimestreCard({ info, isExpanded, onToggle }: {
  info: BimestreInfo | null;
  bimestre: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const pct = info?.pct ?? null;
  const cor = corFreqValor(pct);
  const semDados = !info || info.aulas === 0;

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer",
        isExpanded ? "ring-1" : "hover:border-white/20",
        semDados ? "border-white/8" : "border-white/10"
      )}
      style={isExpanded ? { borderColor: `${cor}60` } : {}}
      onClick={onToggle}
    >
      {/* Cabeçalho do card */}
      <div
        className="p-4 flex items-center gap-3"
        style={{ background: semDados ? "rgba(255,255,255,0.03)" : `linear-gradient(135deg, ${cor}15, ${cor}06)` }}
      >
        <FreqRing pct={pct} cor={cor} size={64} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {info?.bimestre ?? "—"}º Bimestre
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">{BIMESTRE_MESES[info?.bimestre ?? 1]}</p>
            </div>
            {!semDados && (
              isExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-600 shrink-0" />
            )}
          </div>

          {semDados ? (
            <p className="text-xs text-gray-600 mt-2">Sem registros</p>
          ) : (
            <div className="flex gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">{info!.presencas}</span>
                <span className="text-[10px] text-gray-500">pres.</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs font-bold text-red-400">{info!.faltas}</span>
                <span className="text-[10px] text-gray-500">faltas</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-600" />
                <span className="text-xs text-gray-500">{info!.aulas} dias</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expansão com meses */}
      <AnimatePresence>
        {isExpanded && !semDados && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-bold">Detalhamento mensal</p>
              {info!.meses.map((m) => (
                <MesBar key={m.mes} info={m} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Painel principal do Diário ─── */
function DiarioFrequenciaPanel({ alunoId, cor }: { alunoId: number; cor: string }) {
  const [dados, setDados] = useState<DiarioFreq | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/diario/aluno/${alunoId}/frequencia`, { credentials: "include" })
      .then((r) => r.json())
      .then(setDados)
      .catch(() => setDados(null))
      .finally(() => setLoading(false));
  }, [alunoId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: cor }} />
    </div>
  );

  const semNenhumDado = !dados || dados.total.aulas === 0;
  const totalPct = dados?.total.pct ?? null;
  const totalCor = corFreqValor(totalPct);

  return (
    <div className="space-y-5">
      {/* Banner anual */}
      {!semNenhumDado && dados && (
        <div
          className="rounded-2xl p-5 flex items-center gap-5 border border-white/10"
          style={{ background: `linear-gradient(135deg, ${totalCor}18, ${totalCor}06)` }}
        >
          <FreqRing pct={totalPct} cor={totalCor} size={88} />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Frequência Anual · Diário</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black" style={{ color: totalCor }}>
                {totalPct !== null ? `${totalPct}%` : "—"}
              </span>
              <StatusBadge pct={totalPct} />
            </div>
            <div className="flex gap-4 mt-2.5">
              <div className="text-center">
                <p className="text-lg font-black text-emerald-400">{dados.total.presencas}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Presenças</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-lg font-black text-red-400">{dados.total.faltas}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Faltas</p>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <p className="text-lg font-black text-gray-300">{dados.total.aulas}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Dias letivos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards dos bimestres */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">Por bimestre</p>
        </div>

        {semNenhumDado ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-14 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-700" />
            <p className="text-sm text-gray-500 font-medium">Nenhum dia letivo registrado no Diário</p>
            <p className="text-xs text-gray-600 mt-1">
              Acesse o Diário de Classe da turma e marque os dias letivos para ver a frequência aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((b) => {
              const info = dados?.bimestres?.[b] ?? null;
              return (
                <BimestreCard
                  key={b}
                  bimestre={b}
                  info={info ? { ...info, bimestre: b } : null}
                  isExpanded={expandido === b}
                  onToggle={() => setExpandido((prev) => (prev === b ? null : b))}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda rápida */}
      {!semNenhumDado && (
        <div className="flex flex-wrap gap-3 px-1">
          {[
            { cor: "#10b981", label: "≥ 75% · Regular" },
            { cor: "#f59e0b", label: "50–74% · Em risco" },
            { cor: "#ef4444", label: "< 50% · Irregular" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.cor }} />
              <span className="text-[11px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (pct >= 75) return (
    <span className="text-xs font-bold bg-emerald-400/15 text-emerald-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
      <CheckCircle className="w-3 h-3" /> Regular
    </span>
  );
  if (pct >= 50) return (
    <span className="text-xs font-bold bg-yellow-400/15 text-yellow-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" /> Em risco
    </span>
  );
  return (
    <span className="text-xs font-bold bg-red-400/15 text-red-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
      <TrendingUp className="w-3 h-3 rotate-180" /> Irregular
    </span>
  );
}

export default function NotasPresencasAlunoPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "0");

  const { data: aluno, isLoading } = useGetAluno(id, { query: { enabled: !!id } } as any);
  const { data: todosAlunos } = useListarAlunos();
  const { data: turmas } = useListarTurmas();

  const corPorTurma: Record<string, string> = {};
  (turmas ?? []).forEach((t: any) => { if (t.nomeTurma) corPorTurma[t.nomeTurma] = t.cor || COR_PADRAO; });
  const cor = corPorTurma[aluno?.turmaAtual ?? ""] ?? COR_PADRAO;

  const [bimestre, setBimestre] = useState(1);
  const [aba, setAba] = useState<"notas" | "presencas">("presencas");
  const [notasPorBimestre, setNotasPorBimestre] = useState<Record<number, Nota[]>>({ 1: [], 2: [], 3: [], 4: [] });
  const [presencasPorBimestre, setPresencasPorBimestre] = useState<Record<number, Presenca[]>>({ 1: [], 2: [], 3: [], 4: [] });
  const [loadingDados, setLoadingDados] = useState(false);

  const listaIds = (todosAlunos ?? []).map((a) => a.id);
  const posicao = listaIds.indexOf(id);
  const anteriorId = posicao > 0 ? listaIds[posicao - 1] : null;
  const proximoId = posicao < listaIds.length - 1 ? listaIds[posicao + 1] : null;

  useEffect(() => {
    if (!id) return;
    setLoadingDados(true);
    Promise.all([
      fetch(`${BASE}/api/notas/${id}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${BASE}/api/presencas/${id}`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([n, p]) => {
        setNotasPorBimestre(n.porBimestre ?? { 1: [], 2: [], 3: [], 4: [] });
        setPresencasPorBimestre(p.porBimestre ?? { 1: [], 2: [], 3: [], 4: [] });
      })
      .catch(() => {})
      .finally(() => setLoadingDados(false));
  }, [id]);

  const notasAtivas = notasPorBimestre[bimestre] ?? [];
  const presencasAtivas = presencasPorBimestre[bimestre] ?? [];
  const inicial = (aluno?.nomeCompleto || "?")[0].toUpperCase();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-8">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/notas-presencas")}
            className="flex items-center gap-2 text-sm font-bold border px-4 py-2 rounded-xl transition-all"
            style={{ color: cor, borderColor: `${cor}44`, background: `${cor}10` }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="flex items-center gap-3">
            {posicao >= 0 && <span className="text-xs text-muted-foreground">{posicao + 1} de {listaIds.length}</span>}
            <button onClick={() => anteriorId && navigate(`/notas-presencas/${anteriorId}`)} disabled={!anteriorId}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => proximoId && navigate(`/notas-presencas/${proximoId}`)} disabled={!proximoId}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: cor }} />
          </div>
        ) : aluno ? (
          <>
            {/* Hero do aluno */}
            <div
              className="rounded-2xl p-1 shadow-xl"
              style={{ background: `linear-gradient(135deg, ${cor}, ${cor}66)`, boxShadow: `0 12px 32px ${cor}33` }}
            >
              <div className="bg-black/20 rounded-[14px] px-6 py-4 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shrink-0"
                  style={{ background: "rgba(255,255,255,0.15)" }}>
                  {inicial}
                </div>
                <div>
                  <p className="text-xl font-extrabold text-white leading-tight">{aluno.nomeCompleto}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {aluno.turmaAtual && (
                      <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{aluno.turmaAtual}</span>
                    )}
                    {aluno.turno && (
                      <span className="bg-black/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">{aluno.turno}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Seletor de aba */}
            <div className="flex gap-3">
              {(["presencas", "notas"] as const).map((tab) => {
                const isAtivo = aba === tab;
                const tabCor = tab === "notas" ? "#3b82f6" : "#10b981";
                const Icone = tab === "notas" ? BookOpen : Activity;
                return (
                  <button key={tab} onClick={() => setAba(tab)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all"
                    style={isAtivo
                      ? { background: tabCor, borderColor: tabCor, color: "#fff", boxShadow: `0 4px 16px ${tabCor}44` }
                      : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)" }}
                  >
                    <Icone className="h-4 w-4" />
                    {tab === "notas" ? "Notas" : "Presenças"}
                  </button>
                );
              })}
            </div>

            {/* Conteúdo */}
            <AnimatePresence mode="wait">
              <motion.div key={aba}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {aba === "notas" ? (
                  <>
                    {/* Seletor de bimestre */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[1, 2, 3, 4].map((b) => (
                        <BimestreTab key={b} b={b} ativo={bimestre === b} onClick={() => setBimestre(b)} cor="#3b82f6" />
                      ))}
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={bimestre}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}>
                        {loadingDados ? (
                          <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : notasAtivas.length === 0 ? (
                          <EmptyState texto={`Nenhuma nota registrada no ${bimestre}º bimestre.`} suap />
                        ) : (
                          <TabelaNotas notas={notasAtivas} />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </>
                ) : (
                  <div className="space-y-8">
                    {/* ── Diário de Classe (novo painel visual) ── */}
                    <DiarioFrequenciaPanel alunoId={id} cor={cor} />

                    {/* ── Presenças SUAP (se existirem) ── */}
                    {Object.values(presencasPorBimestre).some((arr) => arr.length > 0) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex-1 h-px bg-white/8" />
                          <span className="text-[10px] uppercase tracking-widest text-gray-600 font-bold px-2">
                            Presenças SUAP (por bimestre)
                          </span>
                          <div className="flex-1 h-px bg-white/8" />
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {[1, 2, 3, 4].map((b) => (
                            <BimestreTab key={b} b={b} ativo={bimestre === b} onClick={() => setBimestre(b)} cor="#10b981" />
                          ))}
                        </div>
                        {loadingDados ? (
                          <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                          </div>
                        ) : presencasAtivas.length === 0 ? (
                          <EmptyState texto={`Nenhuma presença SUAP no ${bimestre}º bimestre.`} suap />
                        ) : (
                          <TabelaPresencas presencas={presencasAtivas} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground">Aluno não encontrado.</div>
        )}
      </div>
    </AppLayout>
  );
}

function EmptyState({ texto, suap }: { texto: string; suap?: boolean }) {
  return (
    <div className="text-center py-12 text-muted-foreground bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
      <ClipboardListIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
      <p className="text-sm">{texto}</p>
      {suap && <p className="text-xs mt-1 opacity-50">Os dados serão importados via sincronização com o SUAP.</p>}
    </div>
  );
}

function ClipboardListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 7h6m-6 4h6m-6-8h.01" />
    </svg>
  );
}

function TabelaNotas({ notas }: { notas: Nota[] }) {
  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl">
      <table className="w-full text-sm">
        <thead className="bg-[#0f172a]">
          <tr>
            <th className="text-left px-5 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Disciplina</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Nota 1</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Nota 2</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Nota Final</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Média</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Situação</th>
          </tr>
        </thead>
        <tbody>
          {notas.map((n, i) => {
            const media = n.mediaFinal ? parseFloat(n.mediaFinal) : null;
            return (
              <tr key={n.id} className={cn("border-b border-white/[0.04] hover:bg-white/[0.03]", i % 2 !== 0 && "bg-white/[0.01]")}>
                <td className="px-5 py-3 font-medium text-white">{n.disciplina}</td>
                <td className={cn("px-4 py-3 text-center font-mono font-bold", corNota(n.nota1 ? parseFloat(n.nota1) : null))}>
                  {n.nota1 ?? "—"}
                </td>
                <td className={cn("px-4 py-3 text-center font-mono font-bold", corNota(n.nota2 ? parseFloat(n.nota2) : null))}>
                  {n.nota2 ?? "—"}
                </td>
                <td className={cn("px-4 py-3 text-center font-mono font-bold", corNota(n.notaFinal ? parseFloat(n.notaFinal) : null))}>
                  {n.notaFinal ?? "—"}
                </td>
                <td className={cn("px-4 py-3 text-center font-mono font-black text-base", corNota(media))}>
                  {media !== null ? media.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <SituacaoBadge situacao={n.situacao} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaPresencas({ presencas }: { presencas: Presenca[] }) {
  return (
    <div className="bg-[#111827] rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl">
      <table className="w-full text-sm">
        <thead className="bg-[#0f172a]">
          <tr>
            <th className="text-left px-5 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Disciplina</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Total Aulas</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Faltas</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Presenças</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Frequência</th>
            <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Status</th>
          </tr>
        </thead>
        <tbody>
          {presencas.map((p, i) => {
            const freq = p.percentualFrequencia ? parseFloat(p.percentualFrequencia) : null;
            const presentes = (p.totalAulas ?? 0) - (p.faltas ?? 0);
            return (
              <tr key={p.id} className={cn("border-b border-white/[0.04] hover:bg-white/[0.03]", i % 2 !== 0 && "bg-white/[0.01]")}>
                <td className="px-5 py-3 font-medium text-white">{p.disciplina}</td>
                <td className="px-4 py-3 text-center text-muted-foreground font-mono">{p.totalAulas ?? "—"}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-red-400">{p.faltas ?? "—"}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">{presentes}</td>
                <td className={cn("px-4 py-3 text-center font-mono font-black text-base", corFreqText(freq))}>
                  {freq !== null ? `${freq.toFixed(1)}%` : "—"}
                  {freq !== null && (
                    <div className="w-full bg-white/10 rounded-full h-1 mt-1.5">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{ width: `${Math.min(freq, 100)}%`, background: corFreqValor(freq) }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {freq !== null && (
                    freq >= 75
                      ? <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Regular</span>
                      : <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Em risco</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SituacaoBadge({ situacao }: { situacao: string | null }) {
  if (!situacao) return <span className="text-muted-foreground">—</span>;
  const lower = situacao.toLowerCase();
  if (lower.includes("aprovado") || lower.includes("apto"))
    return <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Aprovado</span>;
  if (lower.includes("reprovado"))
    return <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">Reprovado</span>;
  return <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">{situacao}</span>;
}

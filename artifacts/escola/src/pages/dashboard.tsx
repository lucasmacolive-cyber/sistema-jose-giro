import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { 
  Users, BookOpen, UserCircle, Printer, Bell, ArrowRight,
  TrendingUp, Loader2, FileText, ShieldAlert, AlertTriangle,
  CheckCircle2, Check, Info, Trash2, Activity, ArrowRightLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { WidgetAniversariantes, TickerAniversariantes, Aniversariante } from "@/components/WidgetAniversariantes";
import { CalendarioWidget } from "@/components/CalendarioWidget";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

// interface Aniversariante { nome: string; tipo: string; info: string; diaMes: string; diasAte: number; } // removido para evitar conflito
interface DadosAniv { hoje: Aniversariante[]; semana: Aniversariante[]; mes: Aniversariante[]; }
interface Alerta { id: number; tipo: string; mensagem: string; lido: boolean; criadoEm: string; dados?: any; }
interface AlunoFreq { alunoId: number; nome: string; turma: string; pct: number; total: number; pres: number; }
interface FreqStats { topAlunos: AlunoFreq[]; bottomAlunos: AlunoFreq[]; }
interface FicaiAlerta { alunoId: number; nome: string; turma: string; faltasConsecutivas: number; semanas: string[]; }

/* ─── Anel de frequência ─── */
function FreqRing({ pct, size = 72 }: { pct: number | null; size?: number }) {
  const cor = pct === null ? "#64748b" : pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const filled = pct !== null ? (pct / 100) * circ : 0;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor}
        strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.6s ease", filter: `drop-shadow(0 0 6px ${cor}88)` }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill={pct !== null ? "#fff" : "#475569"} fontSize={pct !== null ? 14 : 10} fontWeight="bold"
      >
        {pct !== null ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}

function formatarTempo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} dia${dias !== 1 ? "s" : ""}`;
}

function iconeAlerta(tipo: string) {
  if (tipo === "login_falho") return { Icon: ShieldAlert, cor: "text-red-400", bg: "bg-red-500/15 border-red-500/20" };
  if (tipo === "impressao") return { Icon: Printer, cor: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/20" };
  if (tipo === "aviso") return { Icon: AlertTriangle, cor: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/20" };
  if (tipo === "sucesso") return { Icon: CheckCircle2, cor: "text-green-400", bg: "bg-green-500/15 border-green-500/20" };
  return { Icon: Info, cor: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/20" };
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const [, navigate] = useLocation();
  const [aniversario, setAniversario] = useState<DadosAniv | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [marcandoLido, setMarcandoLido] = useState<number | null>(null);
  const [apagandoLidos, setApagandoLidos] = useState(false);
  const [freqStats, setFreqStats] = useState<FreqStats | null>(null);
  const [ficaiAlertas, setFicaiAlertas] = useState<FicaiAlerta[]>([]);

  const carregarAniv = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}api/aniversariantes`, { credentials: "include" });
      if (r.ok) setAniversario(await r.json());
    } catch { /* silencioso */ }
  }, []);

  const carregarAlertas = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}api/alertas`, { credentials: "include" });
      if (r.ok) setAlertas(await r.json());
    } catch { /* silencioso */ }
  }, []);

  const marcarLido = async (id: number) => {
    setMarcandoLido(id);
    try {
      await fetch(`${BASE_URL}api/alertas/${id}/lido`, { method: "PATCH", credentials: "include" });
      setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, lido: true } : a));
    } catch { /* silencioso */ }
    setMarcandoLido(null);
  };

  const apagarAlertasLidos = async () => {
    setApagandoLidos(true);
    try {
      await fetch(`${BASE_URL}api/alertas/lidos`, { method: "DELETE", credentials: "include" });
      setAlertas((prev) => prev.filter((a) => !a.lido));
    } catch { /* silencioso */ }
    setApagandoLidos(false);
  };

  useEffect(() => {
    carregarAniv();
    const intervaloAniv = setInterval(carregarAniv, 60 * 60 * 1000);
    return () => clearInterval(intervaloAniv);
  }, [carregarAniv]);

  useEffect(() => {
    carregarAlertas();
    const intervaloAlertas = setInterval(carregarAlertas, 60 * 1000);
    return () => clearInterval(intervaloAlertas);
  }, [carregarAlertas]);

  useEffect(() => {
    fetch(`${BASE_URL}api/diario/frequencia-stats`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFreqStats(d); })
      .catch(() => {});
    fetch(`${BASE_URL}api/diario/ficai`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setFicaiAlertas(d); })
      .catch(() => {});
  }, []);

  const statCards = [
    { title: "Total de Alunos",   value: stats?.totalAlunos || 0,         icon: Users,       color: "from-blue-500/20 to-blue-600/5",     textColor: "text-blue-500",    href: "/alunos" },
    { title: "Turmas Ativas",     value: stats?.totalTurmas || 0,         icon: BookOpen,    color: "from-purple-500/20 to-purple-600/5", textColor: "text-purple-500",  href: "/turmas" },
    { title: "Professores",       value: stats?.totalProfessores || 0,    icon: UserCircle,  color: "from-emerald-500/20 to-emerald-600/5", textColor: "text-emerald-500", href: "/professores" },
    { title: "Impressões Pend.",  value: stats?.impressoesPendentes || 0, icon: Printer,     color: "from-orange-500/20 to-orange-600/5", textColor: "text-orange-500",  href: "/impressoes" },
  ];

  const alertasNaoLidos = alertas.filter((a) => !a.lido);
  const alertasLidos = alertas.filter((a) => a.lido);
  const alertasExibidos = alertas.slice(0, 15);

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-3xl font-display font-bold">Visão Geral</h1>
              <p className="text-muted-foreground mt-1 text-sm">Acompanhe os principais indicadores da E.M. José Giró Faísca.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <WidgetAniversariantes />
              <Link href="/impressoes">
                <Button variant="outline" className="bg-card/50 backdrop-blur-sm border-white/10 hover:bg-white/10">
                  <Printer className="mr-2 h-4 w-4 text-primary" />
                  Nova Impressão
                </Button>
              </Link>
              <Link href="/documentos">
                <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30">
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Documento
                </Button>
              </Link>
            </div>
          </div>

          {aniversario && aniversario.hoje.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2"
            >
              <TickerAniversariantes lista={aniversario.hoje} />
            </motion.div>
          )}
        </div>

        {/* ── Cards de estatísticas ─────────────────────────────────────── */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, i) => {
                const isAlunosCard = stat.title === "Total de Alunos";
                const qtdTransf = (stats as any)?.totalTransferidos ?? 0;
                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <div
                      onClick={() => navigate(stat.href)}
                      className="cursor-pointer"
                    >
                      <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-xl hover:bg-card/60 transition-all duration-300 group hover:-translate-y-1">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1 min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                              <p className="text-4xl font-display font-bold text-foreground group-hover:text-primary transition-colors">
                                {stat.value}
                              </p>
                              {isAlunosCard && qtdTransf > 0 && (
                                <Link
                                  href="/transferidos"
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/70 hover:text-amber-300 transition-colors font-semibold">
                                    <ArrowRightLeft className="h-3 w-3" />
                                    {qtdTransf} transferido{qtdTransf !== 1 ? "s" : ""}
                                  </span>
                                </Link>
                              )}
                            </div>
                            <div className={`p-3 rounded-2xl bg-gradient-to-br ${stat.color} shrink-0`}>
                              <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
              {/* ── Alertas ──────────────────────────────────────────────── */}
              <Card className="lg:col-span-2 bg-card/40 backdrop-blur-md border-white/5 shadow-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Alertas Recentes
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {alertasNaoLidos.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                          {alertasNaoLidos.length} {alertasNaoLidos.length === 1 ? "novo" : "novos"}
                        </span>
                      )}
                      {alertasLidos.length > 0 && (
                        <button
                          onClick={apagarAlertasLidos}
                          disabled={apagandoLidos}
                          title="Apagar todos os alertas lidos"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 border border-red-500/0 hover:border-red-500/20 transition-all disabled:opacity-50"
                        >
                          {apagandoLidos ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Apagar lidos
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {alertasExibidos.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>Nenhum alerta no momento.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
                      <AnimatePresence>
                        {alertasExibidos.map((alerta) => {
                          const { Icon, cor, bg } = iconeAlerta(alerta.tipo);
                          return (
                            <motion.div
                              key={alerta.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: alerta.lido ? 0.38 : 1, x: 0 }}
                              exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                              transition={{ duration: 0.25 }}
                              className={`flex items-start gap-3 px-4 py-3 group transition-colors ${alerta.lido ? "grayscale-[40%]" : "bg-white/[0.02]"}`}
                            >
                              <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${alerta.lido ? "bg-white/5 border-white/10" : bg}`}>
                                <Icon className={`h-4 w-4 ${alerta.lido ? "text-white/30" : cor}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug ${alerta.lido ? "text-muted-foreground/60 line-through decoration-white/20" : "text-white/90"}`}>
                                  {alerta.mensagem}
                                </p>
                                <p className="text-[0.65rem] text-muted-foreground/40 mt-0.5">
                                  {formatarTempo(alerta.criadoEm)}
                                  {alerta.lido && <span className="ml-2 italic">· lido</span>}
                                </p>
                              </div>
                              {!alerta.lido && (
                                <button
                                  onClick={() => marcarLido(alerta.id)}
                                  disabled={marcandoLido === alerta.id}
                                  title="Marcar como lido"
                                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                  {marcandoLido === alerta.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Ações rápidas ─────────────────────────────────────────── */}
              <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 shadow-xl shadow-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Ações Rápidas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/alunos">
                    <Button variant="ghost" className="w-full justify-between bg-card/50 hover:bg-card border-white/5 h-12">
                      Buscar Aluno
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Link>
                  <Link href="/sync">
                    <Button variant="ghost" className="w-full justify-between bg-card/50 hover:bg-card border-white/5 h-12">
                      Sincronizar SUAP
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Link>
                  <Link href="/turmas">
                    <Button variant="ghost" className="w-full justify-between bg-card/50 hover:bg-card border-white/5 h-12">
                      Listas de Presença
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* ── Calendário Letivo ─────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <CalendarioWidget />
            </motion.div>

            {/* ── Card de Frequência ──────────────────────────────────────── */}
            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-400" />
                    Frequência Geral
                  </CardTitle>
                  <Link href="/notas-presencas">
                    <button className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
                      Ver todos <ArrowRight className="h-3 w-3" />
                    </button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                  {/* Maior frequência */}
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-emerald-400 mb-3">Maior Frequência</p>
                    {freqStats?.topAlunos?.length ? (
                      <div className="space-y-3">
                        {freqStats.topAlunos.slice(0, 3).map((a, i) => (
                          <Link key={a.alunoId} href={`/notas-presencas/${a.alunoId}`}>
                            <div className="flex items-center gap-3 hover:bg-white/5 rounded-xl p-1.5 -mx-1.5 transition-colors cursor-pointer">
                              <FreqRing pct={a.pct} size={i === 0 ? 56 : 44} />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-white text-sm truncate leading-tight">{a.nome}</p>
                                <p className="text-[0.65rem] text-emerald-400/70 font-mono mt-0.5">{a.turma}</p>
                                <p className="text-[0.65rem] text-muted-foreground">{a.pres} pres. / {a.total} aulas</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                    )}
                  </div>

                  {/* Menor frequência */}
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-red-400 mb-3">Menor Frequência</p>
                    {freqStats?.bottomAlunos?.length ? (
                      <div className="space-y-3">
                        {freqStats.bottomAlunos.slice(0, 3).map((a, i) => (
                          <Link key={a.alunoId} href={`/notas-presencas/${a.alunoId}`}>
                            <div className="flex items-center gap-3 hover:bg-white/5 rounded-xl p-1.5 -mx-1.5 transition-colors cursor-pointer">
                              <FreqRing pct={a.pct} size={i === 0 ? 56 : 44} />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-white text-sm truncate leading-tight">{a.nome}</p>
                                <p className="text-[0.65rem] text-red-400/70 font-mono mt-0.5">{a.turma}</p>
                                <p className="text-[0.65rem] text-muted-foreground">{a.pres} pres. / {a.total} aulas</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                    )}
                  </div>

                  {/* Alertas FICAI */}
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-orange-400 mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Alertas FICAI
                      {ficaiAlertas.length > 0 && (
                        <span className="ml-auto bg-orange-500/30 text-orange-300 text-[0.6rem] font-black px-2 py-0.5 rounded-full">
                          {ficaiAlertas.length}
                        </span>
                      )}
                    </p>
                    {ficaiAlertas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
                        <p className="text-xs text-muted-foreground text-center">Nenhum alerta de faltas consecutivas</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {ficaiAlertas.map((a) => (
                          <Link key={a.alunoId} href={`/notas-presencas/${a.alunoId}`}>
                            <div className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="mt-0.5 w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white text-xs truncate leading-tight">{a.nome}</p>
                                <p className="text-[0.65rem] text-orange-400/70 font-mono">{a.turma}</p>
                                <p className="text-[0.6rem] text-muted-foreground mt-0.5">
                                  {a.faltasConsecutivas} falta{a.faltasConsecutivas !== 1 ? "s" : ""} consec.
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen, Users, Sun, Sunset, Loader2, ChevronRight,
  GraduationCap, RefreshCcw, Check, Clock, XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "@/hooks/use-toast";

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

  const [fase, setFase] = useState<"idle"|"baixando"|"done"|"error">("idle");
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, msg: "", turmaAtual: "" });
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<{
    resultados: { turma: string; aulas: number; presencas: number; erro?: string }[];
    turmasSemLink: string[];
  } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const carregarUltimaSync = useCallback(() => {
    fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.links?.length) return;
        const datas = (d.links as { ultimaSync: string | null }[])
          .map(l => l.ultimaSync)
          .filter(Boolean)
          .map(s => new Date(s!).getTime());
        if (datas.length > 0) setUltimaSync(new Date(Math.max(...datas)).toISOString());
      })
      .catch(() => {});
  }, []);

  useEffect(() => { carregarUltimaSync(); }, [carregarUltimaSync]);

  const iniciarSincronizacao = async () => {
    if (fase === "baixando") return;
    setFase("baixando");
    setRelatorio(null);

    try {
      // Busca turmas com link cadastrado
      const turmasResp = await fetch(`${BASE}/api/diario/turmas`, { credentials: "include" }).then(r => r.json());
      const todasTurmas: TurmaInfo[] = Array.isArray(turmasResp) ? turmasResp : [];

      // Busca quais turmas têm link SUAP cadastrado em diario_links
      const linksResp = await fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" }).then(r => r.json()).catch(() => ({ links: [] }));

      // Busca links na tabela de turmas também (campo linkSuap)
      const turmasDetalhes = await fetch(`${BASE}/api/turmas`, { credentials: "include" }).then(r => r.json()).catch(() => []);

      const turmasComLinkSet = new Set<string>();

      // 1. Da tabela de turmas
      (Array.isArray(turmasDetalhes) ? turmasDetalhes : [])
        .filter((t: any) => t.linkSuap)
        .forEach((t: any) => {
          if (t.nomeTurma) turmasComLinkSet.add(t.nomeTurma);
        });

      // 2. Da tabela diario_links
      (linksResp.links ?? []).forEach((l: any) => {
        if (l.turma) {
          const correspondente = todasTurmas.find(t => t.nomeTurma.toUpperCase() === l.turma.toUpperCase());
          if (correspondente) {
            turmasComLinkSet.add(correspondente.nomeTurma);
          } else {
            turmasComLinkSet.add(l.turma);
          }
        }
      });

      const turmasComLink = Array.from(turmasComLinkSet);

      if (turmasComLink.length === 0) {
        setFase("error");
        toast({ title: "Nenhum link cadastrado", description: "Configure os links SUAP em Ajustes → Turmas.", variant: "destructive" });
        setTimeout(() => setFase("idle"), 6000);
        return;
      }

      const total = turmasComLink.length;
      const resultados: { turma: string; aulas: number; presencas: number; erro?: string }[] = [];
      const turmasSemLink = todasTurmas.map(t => t.nomeTurma).filter(n => !turmasComLink.includes(n));
      let ultimaSyncLocal: string | null = null;

      for (let i = 0; i < turmasComLink.length; i++) {
        const nomeTurma = turmasComLink[i];
        setProgresso({ atual: i, total, msg: `Baixando ${nomeTurma} (${i + 1}/${total})...`, turmaAtual: nomeTurma });

        try {
          const r = await fetch(`${BASE}/api/sync/baixar-diario-turma`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turma: nomeTurma }),
          });
          const data = await r.json();
          if (!r.ok || !data.ok) {
            resultados.push({ turma: nomeTurma, aulas: 0, presencas: 0, erro: data.mensagem ?? "Erro desconhecido" });
          } else {
            resultados.push({ turma: nomeTurma, aulas: data.totalAulas ?? 0, presencas: data.totalPresencas ?? 0 });
            ultimaSyncLocal = new Date().toISOString();
          }
        } catch (e: any) {
          resultados.push({ turma: nomeTurma, aulas: 0, presencas: 0, erro: e.message ?? "Erro de conexão" });
        }
      }

      const concluidos = resultados.filter(r => !r.erro).length;
      const comErro = resultados.filter(r => r.erro).length;

      setProgresso({ atual: total, total, msg: `${concluidos} turmas sincronizadas${comErro > 0 ? ` · ${comErro} com erro` : ""}`, turmaAtual: "" });
      setFase("done");
      setRelatorio({ resultados, turmasSemLink });
      if (ultimaSyncLocal) setUltimaSync(ultimaSyncLocal);
      carregarUltimaSync();
      toast({ title: "Diários sincronizados!", description: `${concluidos} turmas atualizadas${comErro > 0 ? ` · ${comErro} com erro` : ""}` });

    } catch (e: any) {
      setFase("error");
      setProgresso(p => ({ ...p, msg: e.message || "Erro de conexão" }));
      toast({ title: "Erro de conexão", variant: "destructive" });
      setTimeout(() => setFase("idle"), 5000);
    }
  };

  useEffect(() => () => pararPolling(), [pararPolling]);

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

      {manha.length > 0 && (
        <Section titulo="Turno da Manhã" icon={<Sun className="w-4 h-4" />} turmas={manha} />
      )}
      {tarde.length > 0 && (
        <Section titulo="Turno da Tarde" icon={<Sunset className="w-4 h-4" />} turmas={tarde} />
      )}
      {outros.length > 0 && (
        <Section titulo="Outros Turnos" icon={<GraduationCap className="w-4 h-4" />} turmas={outros} />
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
    </AppLayout>
  );
}

function Section({ titulo, icon, turmas }: { titulo: string; icon: React.ReactNode; turmas: TurmaInfo[] }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">{titulo}</h2>
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-500">{turmas.length} turmas</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {turmas.map((t) => (
          <TurmaCard key={t.id} turma={t} />
        ))}
      </div>
    </div>
  );
}

function TurmaCard({ turma }: { turma: TurmaInfo }) {
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

          <div
            className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1 w-fit"
            style={{ background: "rgba(0,0,0,0.18)" }}
          >
            <Users className="w-3 h-3" />
            <span>{turma.totalAlunos} alunos</span>
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

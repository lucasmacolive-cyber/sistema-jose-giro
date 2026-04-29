// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen, Users, Sun, Sunset, Loader2, ChevronRight,
  GraduationCap, RefreshCcw, Check, Clock,
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
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, msg: "" });
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
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
    setProgresso({ atual: 0, total: 0, msg: "Iniciando..." });
    try {
      const r = await fetch(`${BASE}/api/sync/baixar-todos-diarios`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setFase("error");
        setProgresso(p => ({ ...p, msg: data.mensagem || "Erro ao iniciar" }));
        toast({ title: "Erro", description: data.mensagem, variant: "destructive" });
        setTimeout(() => setFase("idle"), 5000);
        return;
      }
      setProgresso({ atual: 0, total: data.total, msg: "Baixando..." });

      pollingRef.current = setInterval(async () => {
        try {
          const s = await fetch(`${BASE}/api/sync/baixar-todos-status`, { credentials: "include" }).then(r => r.json());
          setProgresso({ atual: s.atual, total: s.total, msg: s.msg });
          if (s.concluido) {
            pararPolling();
            if (s.erro && !s.ultimaSync) {
              setFase("error");
              setTimeout(() => setFase("idle"), 6000);
            } else {
              setFase("done");
              if (s.ultimaSync) setUltimaSync(s.ultimaSync);
              carregarUltimaSync();
              toast({ title: "Diários sincronizados!", description: s.msg });
            }
          }
        } catch { /* ignora */ }
      }, 2000);
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
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={iniciarSincronizacao}
            disabled={fase === "baixando"}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all border overflow-hidden ${
              fase === "baixando"
                ? "border-amber-400/50 text-amber-300 cursor-wait"
                : fase === "done"
                ? "border-emerald-400/50 text-emerald-300 hover:opacity-90"
                : "border-red-500/40 text-red-300 hover:opacity-90"
            }`}
            style={{
              background: fase === "baixando"
                ? "rgba(245,158,11,0.15)"
                : fase === "done"
                ? "rgba(16,185,129,0.15)"
                : "rgba(239,68,68,0.15)",
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Baixando {progresso.atual > 0 ? `${progresso.atual}/${progresso.total}` : "..."}</>
              ) : fase === "done" ? (
                <><Check className="w-4 h-4" /> Sincronizado</>
              ) : (
                <><RefreshCcw className="w-4 h-4" /> Atualizar todos</>
              )}
            </span>
          </button>
          {fase === "baixando" && progresso.msg && (
            <span className="text-[0.6rem] text-amber-400/70 max-w-[200px] text-right truncate">{progresso.msg}</span>
          )}
          {fase === "done" && (
            <span className="text-[0.6rem] text-emerald-400/70">{progresso.msg}</span>
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

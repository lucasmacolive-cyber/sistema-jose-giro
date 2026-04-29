// @ts-nocheck
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Link } from "wouter";
import { Loader2, ArrowRightLeft, ChevronLeft, User, CalendarDays, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AlunoTransferido {
  id: number;
  nomeCompleto: string;
  turmaAtual: string | null;
  situacao: string | null;
  dataTransferencia: string | null;
  tipoTransferencia: string | null;
  turmaDestino: string | null;
}

function formatarData(dt?: string | null) {
  if (!dt || dt === "-" || dt.trim() === "") return null;
  const d = new Date(dt);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  return dt;
}

export default function TransferidosPage() {
  const [lista, setLista] = useState<AlunoTransferido[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/alunos/transferidos`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setLista(d); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  // Agrupar por turma de origem
  const porTurma: Record<string, AlunoTransferido[]> = {};
  for (const a of lista) {
    const t = a.turmaAtual || "Sem turma";
    if (!porTurma[t]) porTurma[t] = [];
    porTurma[t].push(a);
  }
  const turmas = Object.keys(porTurma).sort();

  return (
    <AppLayout>
      <div className="space-y-8 pb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white border border-white/10">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold text-white" style={{ letterSpacing: "-0.5px" }}>
              Alunos Transferidos
            </h1>
            <p className="text-sm text-white/40 mt-0.5">
              {isLoading ? "…" : `${lista.length} aluno${lista.length !== 1 ? "s" : ""} transferido${lista.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-24 text-white/30">
            <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum aluno transferido registrado.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {turmas.map((turma, ti) => (
              <motion.div
                key={turma}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: ti * 0.05 }}
              >
                {/* Header da turma */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-amber-400" />
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-amber-400/80">
                    Turma {turma}
                  </h2>
                  <span className="text-xs text-white/20 font-mono">
                    {porTurma[turma].length} aluno{porTurma[turma].length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Lista de alunos */}
                <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "#0f172a" }}>
                  {porTurma[turma].map((aluno, i) => {
                    const data = formatarData(aluno.dataTransferencia);
                    const ehExterno = aluno.situacao?.toLowerCase().includes("externo");
                    return (
                      <Link key={aluno.id} href={`/alunos/${aluno.id}`}>
                        <div
                          className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 cursor-pointer transition-colors group ${
                            i < porTurma[turma].length - 1 ? "border-b border-white/5" : ""
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                            style={{
                              background: ehExterno ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                              color: ehExterno ? "#f87171" : "#fbbf24",
                            }}
                          >
                            {aluno.nomeCompleto[0]}
                          </div>

                          {/* Nome */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white/80 text-sm group-hover:text-white transition-colors truncate uppercase">
                              {aluno.nomeCompleto}
                            </p>
                          </div>

                          {/* Tipo */}
                          <span
                            className="shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg"
                            style={{
                              background: ehExterno ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                              color: ehExterno ? "#f87171" : "#fbbf24",
                            }}
                          >
                            {ehExterno ? "Externo" : "Interno"}
                          </span>

                          {/* Data */}
                          <div className="shrink-0 flex items-center gap-1.5 text-xs text-white/30 min-w-[140px] justify-end">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {data ? (
                              <span>Transf. em {data}</span>
                            ) : (
                              <span className="text-white/15">Data não registrada</span>
                            )}
                          </div>

                          {/* Seta */}
                          <User className="h-4 w-4 text-white/10 group-hover:text-white/40 transition-colors shrink-0" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// @ts-nocheck
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarAlunos, useListarTurmas } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  Search, Loader2, BookOpen, Activity,
  ChevronRight, Users, ClipboardList
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COR_PADRAO = "#3b82f6";

export default function NotasPresencasPage() {
  const [search, setSearch] = useState("");
  const [turmaFiltro, setTurmaFiltro] = useState<string>("");
  const [, navigate] = useLocation();

  const { data: alunos, isLoading } = useListarAlunos();
  const { data: turmas } = useListarTurmas();

  const corPorTurma: Record<string, string> = {};
  (turmas ?? []).forEach((t: any) => {
    if (t.nomeTurma) corPorTurma[t.nomeTurma] = t.cor || COR_PADRAO;
  });

  const listaTurmas = [...new Set((alunos ?? []).map((a) => a.turmaAtual).filter(Boolean))].sort();

  const filtered = (alunos ?? []).filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.nomeCompleto.toLowerCase().includes(q) || (a.matricula ?? "").includes(q);
    const matchTurma = !turmaFiltro || a.turmaAtual === turmaFiltro;
    return matchSearch && matchTurma;
  });

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">

        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
              Notas & Presenças
            </h1>
            <p className="text-xs text-muted-foreground">Consulte por aluno ou turma</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-11 bg-white/5 border-white/10 focus-visible:ring-primary/30 rounded-xl"
            />
          </div>

          {/* Filtro por turma */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTurmaFiltro("")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                !turmaFiltro
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-lg"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10"
              )}
            >
              Todas
            </button>
            {listaTurmas.map((turma) => {
              const cor = corPorTurma[turma ?? ""] ?? COR_PADRAO;
              const ativo = turmaFiltro === turma;
              return (
                <button
                  key={turma}
                  onClick={() => setTurmaFiltro(ativo ? "" : (turma ?? ""))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  style={ativo
                    ? { background: cor, borderColor: cor, color: "#fff", boxShadow: `0 4px 12px ${cor}55` }
                    : { borderColor: `${cor}44`, background: `${cor}15`, color: cor }}
                >
                  {turma}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contador */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} aluno{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Lista de alunos */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground bg-white/5 rounded-2xl border border-white/5 border-dashed">
            Nenhum aluno encontrado.
          </div>
        ) : (
          <div className="bg-[#111827] rounded-2xl border border-white/[0.07] overflow-hidden shadow-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0f172a] z-10">
                <tr>
                  <th className="text-left px-5 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Aluno</th>
                  <th className="text-left px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 hidden md:table-cell">Turma</th>
                  <th className="text-left px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 hidden md:table-cell">Turno</th>
                  <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Presenças</th>
                  <th className="text-center px-4 py-3.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 border-b border-white/5">Notas</th>
                  <th className="px-4 py-3.5 border-b border-white/5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((aluno, i) => {
                  const cor = corPorTurma[aluno.turmaAtual ?? ""] ?? COR_PADRAO;
                  const inicial = (aluno.nomeCompleto || "?")[0].toUpperCase();
                  return (
                    <tr
                      key={aluno.id}
                      onClick={() => navigate(`/notas-presencas/${aluno.id}`)}
                      className={cn(
                        "border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors cursor-pointer group",
                        i % 2 !== 0 && "bg-white/[0.01]"
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                            style={{ background: `${cor}40`, color: cor }}
                          >
                            {inicial}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-sm">{aluno.nomeCompleto}</p>
                            <p className="text-xs text-muted-foreground font-mono">{aluno.matricula}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: `${cor}20`, color: cor }}>
                          {aluno.turmaAtual || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden md:table-cell">
                        {aluno.turno || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-xs text-muted-foreground">Ver</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs text-muted-foreground">Ver</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white group-hover:translate-x-1 transition-all" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

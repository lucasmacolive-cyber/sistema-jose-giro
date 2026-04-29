// @ts-nocheck
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarAlunos, useListarTurmas } from "@workspace/api-client-react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

const COR_PADRAO = "#3b82f6";

export default function AlunosPage() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { data: alunos, isLoading } = useListarAlunos();
  const { data: turmas } = useListarTurmas();

  // Mapa turmaName -> cor
  const corPorTurma: Record<string, string> = {};
  (turmas ?? []).forEach((t: any) => {
    if (t.nomeTurma) corPorTurma[t.nomeTurma] = t.cor || COR_PADRAO;
  });

  const filtered = (alunos ?? []).filter((a) => {
    // Excluir transferidos — só aparecem na lista de turma com toggle explícito
    if (a.situacao?.toLowerCase().startsWith("transferido")) return false;
    const q = search.toLowerCase();
    return (
      a.nomeCompleto.toLowerCase().includes(q) ||
      (a.matricula ?? "").includes(q) ||
      (a.turmaAtual ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-8 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
            Alunos
          </h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} aluno{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula ou turma..."
            className="pl-11 h-12 bg-card/50 border-white/10 focus-visible:ring-primary/30 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((aluno) => {
              const cor = corPorTurma[aluno.turmaAtual ?? ""] ?? COR_PADRAO;
              const inicial = (aluno.nomeCompleto || "?")[0].toUpperCase();
              const turma = aluno.turmaAtual || "S/T";

              return (
                <div
                  key={aluno.id}
                  onClick={() => navigate(`/alunos/${aluno.id}`)}
                  className="flex items-center h-[90px] rounded-[50px_15px_15px_50px] p-2.5 cursor-pointer border border-white/10 shadow-[0_10px_25px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${cor}, ${cor}99)`,
                    boxShadow: `0 10px 25px ${cor}44`,
                  }}
                >
                  <div className="w-[70px] h-[70px] rounded-full bg-white/25 flex items-center justify-center font-black text-2xl mr-5 shrink-0 text-white">
                    {inicial}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <span className="font-extrabold text-[1.05rem] text-white whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
                      {aluno.nomeCompleto}
                    </span>
                    <span className="text-[0.65rem] font-black bg-black/20 px-2 py-0.5 rounded-lg w-fit mt-1.5 text-white">
                      {turma}
                    </span>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground bg-card/20 rounded-2xl border border-white/5 border-dashed">
                <p>Nenhum aluno encontrado.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

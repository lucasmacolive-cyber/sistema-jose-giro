import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { toast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SyncFase = "idle" | "baixando" | "done" | "error";

interface RelatorioSync {
  resultados: { turma: string; aulas: number; presencas: number; erro?: string }[];
  turmasSemLink: string[];
}

interface SyncContextType {
  fase: SyncFase;
  progresso: { atual: number; total: number; msg: string; turmaAtual: string };
  ultimaSyncGlob: string | null;
  relatorio: RelatorioSync | null;
  iniciarSincronizacaoGlobal: () => Promise<void>;
  carregarUltimaSyncGlobal: () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<SyncFase>("idle");
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, msg: "", turmaAtual: "" });
  const [ultimaSyncGlob, setUltimaSyncGlob] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioSync | null>(null);

  const carregarUltimaSyncGlobal = useCallback(() => {
    fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!d.links?.length) return;
        const datas = (d.links as { ultimaSync: string | null }[])
          .map(l => l.ultimaSync)
          .filter(Boolean)
          .map(s => new Date(s!).getTime());
        if (datas.length > 0) setUltimaSyncGlob(new Date(Math.max(...datas)).toISOString());
      })
      .catch(() => {});
  }, []);

  const iniciarSincronizacaoGlobal = async () => {
    if (fase === "baixando") return;
    setFase("baixando");
    setRelatorio(null);

    try {
      const turmasResp = await fetch(`${BASE}/api/diario/turmas`, { credentials: "include" }).then(r => r.json());
      const todasTurmas = Array.isArray(turmasResp) ? turmasResp : [];

      const linksResp = await fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" }).then(r => r.json()).catch(() => ({ links: [] }));
      const turmasDetalhes = await fetch(`${BASE}/api/turmas`, { credentials: "include" }).then(r => r.json()).catch(() => []);

      const turmasComLinkSet = new Set<string>();

      (Array.isArray(turmasDetalhes) ? turmasDetalhes : [])
        .filter((t: any) => t.linkSuap)
        .forEach((t: any) => { if (t.nomeTurma) turmasComLinkSet.add(t.nomeTurma); });

      (linksResp.links ?? []).forEach((l: any) => {
        if (l.turma) {
          const correspondente = todasTurmas.find((t: any) => t.nomeTurma.toUpperCase() === l.turma.toUpperCase());
          if (correspondente) turmasComLinkSet.add(correspondente.nomeTurma);
          else turmasComLinkSet.add(l.turma);
        }
      });

      const turmasComLink = Array.from(turmasComLinkSet);

      if (turmasComLink.length === 0) {
        setFase("error");
        toast({ title: "Nenhum link cadastrado", description: "Configure os links SUAP em Ajustes.", variant: "destructive" });
        setTimeout(() => setFase("idle"), 6000);
        return;
      }

      const total = turmasComLink.length;
      const resultados: { turma: string; aulas: number; presencas: number; erro?: string }[] = [];
      const turmasSemLink = todasTurmas.map((t: any) => t.nomeTurma).filter((n: string) => !turmasComLink.includes(n));
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
            resultados.push({ turma: nomeTurma, aulas: 0, presencas: 0, erro: data.mensagem ?? "Erro" });
          } else {
            resultados.push({ turma: nomeTurma, aulas: data.totalAulas ?? 0, presencas: data.totalPresencas ?? 0 });
            ultimaSyncLocal = new Date().toISOString();
          }
        } catch (e: any) {
          resultados.push({ turma: nomeTurma, aulas: 0, presencas: 0, erro: e.message ?? "Erro" });
        }
      }

      const concluidos = resultados.filter(r => !r.erro).length;
      const comErro = resultados.filter(r => r.erro).length;

      setProgresso({ atual: total, total, msg: `${concluidos} turmas sincronizadas${comErro > 0 ? ` · ${comErro} com erro` : ""}`, turmaAtual: "" });
      setFase("done");
      setRelatorio({ resultados, turmasSemLink });
      if (ultimaSyncLocal) setUltimaSyncGlob(ultimaSyncLocal);
      carregarUltimaSyncGlobal();
      toast({ title: "Diários sincronizados!", description: `${concluidos} turmas atualizadas` });

    } catch (e: any) {
      setFase("error");
      setProgresso(p => ({ ...p, msg: e.message || "Erro de conexão" }));
      toast({ title: "Erro de conexão", variant: "destructive" });
      setTimeout(() => setFase("idle"), 5000);
    }
  };

  return (
    <SyncContext.Provider value={{ fase, progresso, ultimaSyncGlob, relatorio, iniciarSincronizacaoGlobal, carregarUltimaSyncGlobal }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncGlobal() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSyncGlobal must be used within SyncProvider");
  return context;
}

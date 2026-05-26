// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMe } from "@workspace/api-client-react";
import {
  ChevronLeft, ChevronRight, Loader2, BookOpen, Users,
  Printer, ArrowLeft, Plus, Trash2, CheckCircle2, XCircle,
  AlertTriangle, Info, ArrowRight, ArrowUpDown, CalendarCheck,
  ExternalLink, FileText, Save, RefreshCcw, Check, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { CABECALHO_CSS, obterCabecalhoHTML } from "@/components/CabecalhoTimbrado";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA_CURTO = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function getTodayStr(): string {
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, "0");
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${hoje.getFullYear()}`;
}

function strToDate(ddmmyyyy: string): Date {
  const [dd, mm, yyyy] = ddmmyyyy.split("/");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

/** Compara duas strings DD/MM/YYYY */
function dateStrLe(a: string, b: string): boolean {
  return strToDate(a) <= strToDate(b);
}

/** Semana ISO (segunda = 1º dia) para agrupamento */
function isoWeek(ddmmyyyy: string): string {
  const d = strToDate(ddmmyyyy);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function contrastColor(hex: string): string {
  const clean = (hex || "#3b82f6").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#111827" : "#ffffff";
}

interface Aluno {
  id: number;
  nomeCompleto: string;
  situacao: string;
  tipoTransferencia: string | null;
  dataTransferencia: string | null;
  turmaDestino: string | null;
  turmaOrigem: string | null;
  nivelEnsino: string | null;
  turmaAtual: string | null;
}
interface Aula { id: number; turmaNome: string; data: string; numeroAulas?: number | null; conteudo?: string | null; }
interface AulaAtividade extends Aula { _editConteudo: string; _editNA: number; _salvando: boolean; }
interface DiarioData {
  alunos: Aluno[];
  aulas: Aula[];
  presencas: Record<number, Record<number, string>>;
}
interface TurmaInfo {
  id: number; nomeTurma: string; turno: string;
  professorResponsavel: string | null; cor: string;
}

export default function DiarioTurmaPage() {
  const [, params] = useRoute("/diarios/:turma/:ano/:mes");
  const turmaNome = decodeURIComponent(params?.turma ?? "");
  const anoParam = Number(params?.ano ?? new Date().getFullYear());
  const mesParam = Number(params?.mes ?? new Date().getMonth() + 1);

  const [ano, setAno] = useState(anoParam);
  const [mes, setMes] = useState(mesParam);
  const [pendentes, setPendentes] = useState<Record<string, boolean>>({});
  const [hojeStr, setHojeStr] = useState(getTodayStr);
  const [transferirAluno, setTransferirAluno] = useState<Aluno | null>(null);
  const [perfilAluno, setPerfilAluno] = useState<Aluno | null>(null);
  const [showAtividades, setShowAtividades] = useState(false);
  const [atividades, setAtividades] = useState<AulaAtividade[]>([]);
  const [suapFase, setSuapFase] = useState<"idle"|"baixando"|"done"|"error">("idle");
  const [suapMsg, setSuapMsg] = useState("");
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);

  // Estados para Abono de Faltas (Anexo III)
  const [showAbonoAlunos, setShowAbonoAlunos] = useState(false);
  const [alunoParaAbonar, setAlunoParaAbonar] = useState<Aluno | null>(null);

  // Estados para FICAI
  const [showFicaiModal, setShowFicaiModal] = useState(false);

  useEffect(() => {
    const agora = new Date();
    const meianoite = new Date(agora);
    meianoite.setHours(24, 0, 0, 0);
    const msAteMeianoite = meianoite.getTime() - agora.getTime();
    const timeout = setTimeout(() => {
      setHojeStr(getTodayStr());
      const interval = setInterval(() => setHojeStr(getTodayStr()), 24 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msAteMeianoite);
    return () => clearTimeout(timeout);
  }, []);

  const qc = useQueryClient();

  const { data: turmaInfo } = useQuery<TurmaInfo[]>({
    queryKey: ["diario-turmas"],
    queryFn: () =>
      fetch(`${BASE}/api/diario/turmas`, { credentials: "include" }).then((r) => r.json()),
  });
  const turma = turmaInfo?.find((t) => t.nomeTurma === turmaNome);
  const cor = turma?.cor || "#3b82f6";
  const textoCor = contrastColor(cor);

  const { data: configuracoes } = useQuery<Record<string, string>>({
    queryKey: ["diario-configuracoes"],
    queryFn: () =>
      fetch(`${BASE}/api/diario/configuracoes`, { credentials: "include" }).then((r) => r.json()),
  });
  const ficaiThresholdConsec  = Number(configuracoes?.ficai_faltas_consecutivas ?? 3);
  const ficaiThresholdMensais = Number(configuracoes?.ficai_faltas_mensais ?? 5);

  type LinkMeta = { link: string; turma: string | null; ultimaSync: string | null };
  const { data: linksMeta, refetch: refetchLinksMeta } = useQuery<{ links: LinkMeta[] }>({
    queryKey: ["diario-links-meta"],
    queryFn: () =>
      fetch(`${BASE}/api/sync/diario-links-meta`, { credentials: "include" }).then((r) => r.json()),
  });
  const ultimaSyncTurma = linksMeta?.links?.find(
    l => l.turma?.toUpperCase() === turmaNome.toUpperCase()
  )?.ultimaSync ?? null;

  const { data, isLoading, refetch } = useQuery<DiarioData>({
    queryKey: ["diario-mes", turmaNome, ano, mes],
    queryFn: () =>
      fetch(`${BASE}/api/diario/${encodeURIComponent(turmaNome)}/mes/${ano}/${mes}`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: !!turmaNome,
  });

  const addAulaMut = useMutation({
    mutationFn: (data: string) =>
      fetch(`${BASE}/api/diario/aula`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turmaNome, data }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diario-mes"] }); },
    onError: () => toast({ title: "Erro ao adicionar dia", variant: "destructive" }),
  });

  const removeAulaMut = useMutation({
    mutationFn: (aulaId: number) =>
      fetch(`${BASE}/api/diario/aula/${aulaId}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diario-mes"] }); },
    onError: () => toast({ title: "Erro ao remover dia", variant: "destructive" }),
  });

  const togglePresencaMut = useMutation({
    mutationFn: ({ aulaId, alunoId, status }: { aulaId: number; alunoId: number; status: string }) =>
      fetch(`${BASE}/api/diario/presenca`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aulaId, alunoId, status }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diario-mes"] }); },
  });

  const { refetch: refetchAtividades } = useQuery<Aula[]>({
    queryKey: ["diario-atividades", turmaNome],
    queryFn: () =>
      fetch(`${BASE}/api/diario/${encodeURIComponent(turmaNome!)}/atividades`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: false,
  });

  function openAtividades() {
    refetchAtividades().then(({ data }) => {
      const sorted = [...(data ?? [])].sort((a, b) => {
        const [da, ma, ya] = a.data.split("/").map(Number);
        const [db, mb, yb] = b.data.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
      setAtividades(sorted.map((a) => ({
        ...a,
        _editConteudo: a.conteudo ?? "",
        _editNA: a.numeroAulas ?? 1,
        _salvando: false,
      })));
      setShowAtividades(true);
    });
  }

  const salvarAtividadeMut = useMutation({
    mutationFn: ({ id, conteudo, numeroAulas }: { id: number; conteudo: string; numeroAulas: number }) =>
      fetch(`${BASE}/api/diario/aula/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo, numeroAulas }),
      }).then((r) => r.json()),
    onSuccess: (_, vars) => {
      setAtividades((prev) => prev.map((a) =>
        a.id === vars.id ? { ...a, _salvando: false, conteudo: vars.conteudo, numeroAulas: vars.numeroAulas } : a
      ));
      qc.invalidateQueries({ queryKey: ["diario-mes"] });
      qc.invalidateQueries({ queryKey: ["diario-atividades"] });
    },
    onError: () => toast({ title: "Erro ao salvar atividade", variant: "destructive" }),
  });

  function salvarAtividade(id: number) {
    const item = atividades.find((a) => a.id === id);
    if (!item) return;
    setAtividades((prev) => prev.map((a) => a.id === id ? { ...a, _salvando: true } : a));
    salvarAtividadeMut.mutate({ id, conteudo: item._editConteudo, numeroAulas: item._editNA });
  }

  const cancelTransferMut = useMutation({
    mutationFn: (alunoId: number) =>
      fetch(`${BASE}/api/diario/cancelar-transferencia/${alunoId}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diario-mes"] });
      toast({ title: "Transferência cancelada com sucesso" });
      setPerfilAluno(null);
    },
    onError: () => toast({ title: "Erro ao cancelar transferência", variant: "destructive" }),
  });

  const transferirMut = useMutation({
    mutationFn: (body: { alunoId: number; tipo: string; turmaDestino?: string; dataTransferencia: string }) =>
      fetch(`${BASE}/api/diario/transferir`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diario-mes"] });
      setTransferirAluno(null);
      toast({ title: "Transferência registrada com sucesso" });
    },
    onError: () => toast({ title: "Erro ao registrar transferência", variant: "destructive" }),
  });

  const diasUteisDoMes = useMemo(() => {
    const dias: { dia: number; diaSemana: number; dataStr: string }[] = [];
    const totalDias = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= totalDias; d++) {
      const dt = new Date(ano, mes - 1, d);
      const dSem = dt.getDay();
      if (dSem >= 1 && dSem <= 5) {
        const dd = String(d).padStart(2, "0");
        const mm = String(mes).padStart(2, "0");
        dias.push({ dia: d, diaSemana: dSem, dataStr: `${dd}/${mm}/${ano}` });
      }
    }
    return dias;
  }, [ano, mes]);

  const aulasMap = useMemo(() => {
    const m: Record<string, Aula> = {};
    for (const a of data?.aulas ?? []) m[a.data] = a;
    return m;
  }, [data]);

  function navMes(delta: number) {
    let nm = mes + delta;
    let na = ano;
    if (nm < 1) { nm = 12; na--; }
    if (nm > 12) { nm = 1; na++; }
    setMes(nm);
    setAno(na);
  }

  function toggleDia(dataStr: string) {
    const aula = aulasMap[dataStr];
    if (aula) {
      if (!confirm(`Remover ${dataStr} como dia letivo? As presenças registradas serão apagadas.`)) return;
      removeAulaMut.mutate(aula.id);
    } else {
      addAulaMut.mutate(dataStr);
    }
  }

  function togglePresenca(aulaId: number, alunoId: number) {
    const key = `${aulaId}-${alunoId}`;
    const atual = data?.presencas?.[aulaId]?.[alunoId] ?? "P";
    const novo = atual === "P" ? "F" : "P";
    setPendentes((p) => ({ ...p, [key]: true }));
    togglePresencaMut.mutate({ aulaId, alunoId, status: novo }, {
      onSettled: () => setPendentes((p) => { const n = { ...p }; delete n[key]; return n; }),
    });
  }

  // Frequência por aluno:
  // - presencas/faltas contam apenas aulas já ocorridas (≤ hoje)
  // - total = TODAS as aulas do mês (passadas + futuras) → denominador real do mês
  // - pct sobe gradualmente (presencas / total_do_mês) em vez de ser 100% logo no 1º dia
  function calcFreq(alunoId: number) {
    const todasAulas = data?.aulas ?? [];
    const aulasPassadas = todasAulas.filter((a) => dateStrLe(a.data, hojeStr));
    const totalDoMes = todasAulas.length; // inclui dias futuros já marcados
    if (totalDoMes === 0) return null; // nenhuma aula registrada ainda
    let presencas = 0;
    for (const aula of aulasPassadas) {
      const s = data?.presencas?.[aula.id]?.[alunoId] ?? "P";
      if (s === "P") presencas++;
    }
    const faltas = aulasPassadas.length - presencas;
    return {
      presencas,
      faltas,
      total: totalDoMes,           // total do mês (denominador correto)
      aulasPassadas: aulasPassadas.length,
      pct: Math.round((presencas / totalDoMes) * 100), // cresce gradualmente
    };
  }

  // Total de presenças (contagem absoluta) — só aulas passadas
  function totalPresencas(alunoId: number): number {
    const todasAulas = data?.aulas ?? [];
    const aulasPassadas = todasAulas.filter((a) => dateStrLe(a.data, hojeStr));
    return aulasPassadas.filter((aula) => (data?.presencas?.[aula.id]?.[alunoId] ?? "P") === "P").length;
  }

  // Detectar FICAI: 3+ dias consecutivos OU 5+ faltas no mês atual
  const ficaiAlunos = useMemo(() => {
    const todasAulas = (data?.aulas ?? [])
      .filter((a) => dateStrLe(a.data, hojeStr))
      .sort((a, b) => strToDate(a.data).getTime() - strToDate(b.data).getTime());

    if (todasAulas.length === 0) return [];

    const hojeDate = strToDate(hojeStr);
    const mesAtual  = hojeDate.getMonth() + 1;
    const anoAtual  = hojeDate.getFullYear();

    function ehMesAtual(dataStr: string) {
      const [, m, y] = dataStr.split("/").map(Number);
      return m === mesAtual && y === anoAtual;
    }

    const alunos = data?.alunos ?? [];
    const result: { aluno: Aluno; maxConsecutivo: number; faltasMensais: number; motivos: string[] }[] = [];

    for (const aluno of alunos) {
      if (aluno.situacao !== "Matriculado") continue;

      // 1) Faltas consecutivas (sem restrição de semana)
      let maxConsec = 0, currentConsec = 0;
      for (const aula of todasAulas) {
        const status = data?.presencas?.[aula.id]?.[aluno.id] ?? "P";
        if (status === "F") {
          currentConsec++;
          if (currentConsec > maxConsec) maxConsec = currentConsec;
        } else {
          currentConsec = 0;
        }
      }

      // 2) Total de faltas no mês atual
      const faltasMensais = todasAulas.filter(
        (a) => ehMesAtual(a.data) && (data?.presencas?.[a.id]?.[aluno.id] ?? "P") === "F"
      ).length;

      const motivos: string[] = [];
      if (maxConsec  >= ficaiThresholdConsec)  motivos.push(`${maxConsec} dias consecutivos`);
      if (faltasMensais >= ficaiThresholdMensais) motivos.push(`${faltasMensais} faltas no mês`);

      if (motivos.length > 0) {
        result.push({ aluno, maxConsecutivo: maxConsec, faltasMensais, motivos });
      }
    }

    return result;
  }, [data, hojeStr, ficaiThresholdConsec, ficaiThresholdMensais]);

  // Alunos de Ed. Infantil que foram transferidos externamente
  const alertaHistorico = useMemo(() => {
    return (data?.alunos ?? []).filter(
      (a) =>
        a.situacao === "Transferido Externo" &&
        a.nivelEnsino?.toLowerCase().includes("infant")
    );
  }, [data]);

  const totalAulas = data?.aulas?.length ?? 0;

  function handlePrint() { window.print(); }

  async function atualizarSuap() {
    if (suapFase === "baixando") return;
    setSuapFase("baixando");
    setSuapMsg("");
    try {
      const r = await fetch(`${BASE}/api/sync/baixar-diario-turma`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turma: turmaNome }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setSuapFase("error");
        setSuapMsg(data.mensagem ?? "Erro ao atualizar");
        toast({
          title: "Erro ao atualizar diário",
          description: data.needsMapping
            ? "Baixe este diário primeiro em Ajustes → Sincronização para que o sistema aprenda o mapeamento."
            : (data.mensagem ?? "Erro desconhecido"),
          variant: "destructive",
        });
        setTimeout(() => setSuapFase("idle"), 6000);
        return;
      }
      setSuapFase("done");
      setSuapMsg(`${data.totalAulas} aulas · ${data.totalPresencas} presenças`);
      toast({ title: "Diário atualizado!", description: `${data.totalAulas} aulas e ${data.totalPresencas} presenças importadas.` });
      qc.invalidateQueries({ queryKey: ["diario-mes"] });
      refetchLinksMeta();
    } catch (e: any) {
      setSuapFase("error");
      setSuapMsg(e.message ?? "Erro de conexão");
      toast({ title: "Erro de conexão com o SUAP", variant: "destructive" });
      setTimeout(() => setSuapFase("idle"), 6000);
    }
  }

  async function imprimirDiarioNaRicoh() {
    setImprimindoRicoh(true);
    try {
      let html = `
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 2px; text-align: center; }
            th { background: #f0f0f0; }
            .header { text-align: center; margin-bottom: 10px; }
            .aluno-nome { text-align: left; padding-left: 5px; width: 200px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>DIÁRIO DE CLASSE - ${turmaNome}</h2>
            <p>${MESES[mes-1]} / ${ano} · Professor: ${turma?.professorResponsavel || "—"}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th class="aluno-nome">ALUNO</th>
                ${(data?.aulas ?? []).map(a => `<th>${a.data.split("/")[0]}</th>`).join("")}
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              ${(data?.alunos ?? []).map(aluno => {
                const f = calcFreq(aluno.id);
                return `
                  <tr>
                    <td class="aluno-nome">${aluno.nomeCompleto}</td>
                    ${(data?.aulas ?? []).map(aula => `<td>${(data?.presencas?.[aula.id]?.[aluno.id] || "P")}</td>`).join("")}
                    <td>${f?.pct ?? 0}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Diario_${turmaNome.replace(/\s+/g, "_")}_${mes}_${ano}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const BASE_API = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${BASE_API}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar");
      alert("Diário enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar para a impressora.");
    } finally {
      setImprimindoRicoh(false);
    }
  }

  if (!turmaNome) return (
    <AppLayout>
      <div className="p-8 text-gray-400 flex flex-col gap-4">
        <Link href="/diarios">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/8 hover:bg-white/12 border border-white/15 text-white transition-all">
            <ArrowLeft className="w-4 h-4" /> Voltar para Diários
          </button>
        </Link>
        <p>Turma não encontrada.</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout noPadding>
    <div className="flex flex-col h-full print:h-auto">
      {/* ── Cabeçalho da Turma ── */}
      <div
        className="print:block shrink-0"
        style={{ background: `linear-gradient(135deg, ${cor}dd, ${cor}88)`, color: textoCor }}
      >
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 print:hidden">
          <Link href="/diarios">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border hover:scale-105 active:scale-95"
              style={{
                color: textoCor,
                background: textoCor === "#ffffff" ? "rgba(0,0,0,0.30)" : "rgba(255,255,255,0.30)",
                borderColor: textoCor === "#ffffff" ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </Link>
          <div className="flex-1" />
          {/* Botão Atualizar SUAP — 3 estados: vermelho → amarelo → verde */}
          <button
            className={`no-print relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black transition-all border overflow-hidden ${
              suapFase === "baixando"
                ? "border-amber-400/50 text-amber-300 cursor-wait"
                : suapFase === "done"
                ? "border-emerald-400/50 text-emerald-300 hover:opacity-90 cursor-pointer"
                : suapFase === "error"
                ? "border-red-400/50 text-red-300 hover:opacity-90 cursor-pointer"
                : "border-red-500/40 text-red-300 hover:opacity-90 cursor-pointer"
            }`}
            style={{
              background: suapFase === "baixando"
                ? "rgba(245,158,11,0.18)"
                : suapFase === "done"
                ? "rgba(16,185,129,0.18)"
                : "rgba(239,68,68,0.18)",
            }}
            onClick={atualizarSuap}
            title={suapMsg || "Atualizar diário do SUAP"}
          >
            {suapFase === "baixando" && (
              <span className="absolute inset-0 overflow-hidden rounded-xl">
                <span className="absolute inset-y-0 left-0 bg-amber-400/15 animate-pulse w-full" />
              </span>
            )}
            <span className="relative flex items-center gap-1.5">
              {suapFase === "baixando" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Baixando...</>
              ) : suapFase === "done" ? (
                <><Check className="w-4 h-4" /> Sincronizar</>
              ) : (
                <><RefreshCcw className="w-4 h-4" /> Atualizar</>
              )}
            </span>
          </button>
          <button
            className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border hover:opacity-90"
            style={{
              color: textoCor,
              background: "rgba(0,0,0,0.20)",
              borderColor: "rgba(0,0,0,0.15)",
            }}
            onClick={openAtividades}
          >
            <FileText className="w-4 h-4" />
            Registro de Atividades
          </button>
          <button
            className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border"
            style={{
              color: textoCor,
              background: "rgba(0,0,0,0.20)",
              borderColor: "rgba(0,0,0,0.15)",
            }}
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <a
            href={`${BASE}/api/diario/relatorio-frequencia-mensal?mes=${mes}&ano=${ano}&turma=${encodeURIComponent(turmaNome)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all border hover:opacity-90"
            style={{
              color: textoCor,
              background: "rgba(0,0,0,0.20)",
              borderColor: "rgba(0,0,0,0.15)",
            }}
          >
            <FileText className="w-4 h-4" />
            Resumo de Presenças (PDF)
          </a>
          {isMaster && (
            <button
              onClick={imprimirDiarioNaRicoh}
              disabled={imprimindoRicoh}
              className="no-print flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white border border-white/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {imprimindoRicoh ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              RICOH (Direto)
            </button>
          )}
        </div>

        <div className="px-4 pb-5">
          <div className="print:text-black">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{turmaNome}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <p className="text-sm font-medium opacity-80">
                {turma?.turno} · {turma?.professorResponsavel ?? "—"}
              </p>
              {ultimaSyncTurma && suapFase !== "baixando" && (
                <span className="flex items-center gap-1 text-xs opacity-60 no-print">
                  <Clock className="w-3 h-3" />
                  Sync: {new Date(ultimaSyncTurma).toLocaleDateString("pt-BR")} {new Date(ultimaSyncTurma).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {suapFase === "baixando" && (
                <span className="flex items-center gap-1 text-xs opacity-70 text-amber-300 no-print">
                  <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => navMes(-1)}
              className="p-1.5 rounded-lg hover:bg-black/20 transition-colors no-print"
              style={{ color: textoCor }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center min-w-[120px]">
              <span className="text-lg font-bold">{MESES[mes - 1]}</span>
              <span className="text-sm opacity-70">{ano}</span>
            </div>
            <button
              onClick={() => navMes(1)}
              className="p-1.5 rounded-lg hover:bg-black/20 transition-colors no-print"
              style={{ color: textoCor }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="ml-auto flex gap-2 flex-wrap">
              <StatChip
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                valor={String(totalAulas)}
                label="dias letivos"
                cor={textoCor}
              />
              <StatChip
                icon={<Users className="w-3.5 h-3.5" />}
                valor={String(data?.alunos?.filter(a => a.situacao === "Matriculado").length ?? 0)}
                label="alunos"
                cor={textoCor}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas FICAI ── */}
      {ficaiAlunos.length > 0 && (
        <div className="shrink-0 px-4 pt-3 space-y-2 no-print">
          <div className="rounded-xl border border-orange-700/50 bg-orange-950/60 p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="text-sm font-bold text-orange-300">
                  FICAI — {ficaiAlunos.length === 1 ? "Aluno necessita" : `${ficaiAlunos.length} alunos necessitam`} de ficha de acompanhamento
                </span>
              </div>
              <button
                onClick={() => setShowFicaiModal(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white transition-all active:scale-95 shrink-0 self-start sm:self-auto"
              >
                <FileText className="w-3.5 h-3.5" />
                Gerar Fichas FICAI
              </button>
            </div>
            <p className="text-xs text-orange-300/70 mb-2">
              Critérios: {ficaiThresholdConsec}+ dias letivos consecutivos ou {ficaiThresholdMensais}+ faltas no mês
            </p>
            <div className="flex flex-wrap gap-2">
              {ficaiAlunos.map(({ aluno, motivos }) => (
                <div key={aluno.id} className="text-xs bg-orange-900/60 border border-orange-700/40 rounded-lg px-2.5 py-1.5 text-orange-200 font-medium">
                  {aluno.nomeCompleto.split(" ").slice(0, 2).join(" ")}
                  <span className="ml-1.5 text-orange-400 font-bold">{motivos.join(" / ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Alerta Ed. Infantil transferidos externamente ── */}
      {alertaHistorico.length > 0 && (
        <div className="shrink-0 px-4 pt-2 no-print">
          <div className="rounded-xl border border-purple-700/50 bg-purple-950/60 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-sm font-bold text-purple-300">Histórico escolar pendente</span>
            </div>
            <p className="text-xs text-purple-200/70 mb-2">
              Alunos de Educação Infantil transferidos externamente requerem criação de histórico:
            </p>
            <div className="flex flex-wrap gap-2">
              {alertaHistorico.map((a) => (
                <div key={a.id} className="text-xs bg-purple-900/50 border border-purple-700/40 rounded-lg px-2.5 py-1 text-purple-200 font-medium">
                  {a.nomeCompleto.split(" ").slice(0, 2).join(" ")}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Grade ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        ) : (
          <DiarioGrid
            alunos={data?.alunos ?? []}
            aulas={data?.aulas ?? []}
            presencas={data?.presencas ?? {}}
            aulasMap={aulasMap}
            diasUteis={diasUteisDoMes}
            cor={cor}
            hojeStr={hojeStr}
            pendentes={pendentes}
            onToggleDia={toggleDia}
            onTogglePresenca={togglePresenca}
            calcFreq={calcFreq}
            totalPresencas={totalPresencas}
            ficaiIds={new Set(ficaiAlunos.map((f) => f.aluno.id))}
            onTransferir={(aluno) => setTransferirAluno(aluno)}
            onVerPerfil={(aluno) => setPerfilAluno(aluno)}
            mes={mes}
            ano={ano}
            turmaNome={turmaNome}
            onAbrirAbono={() => setShowAbonoAlunos(true)}
          />
        )}
      </div>

      {/* ── Modal de Perfil do Aluno ── */}
      {perfilAluno && (
        <AlunoPerfilModal
          aluno={perfilAluno}
          cor={cor}
          calcFreq={calcFreq}
          totalPresencas={totalPresencas}
          diasUteisTotal={diasUteisDoMes.length}
          cancelPending={cancelTransferMut.isPending}
          onClose={() => setPerfilAluno(null)}
          onTransferir={() => {
            const a = perfilAluno;
            setPerfilAluno(null);
            setTransferirAluno(a);
          }}
          onCancelarTransferencia={() => cancelTransferMut.mutate(perfilAluno.id)}
        />
      )}

      {/* ── Modal de Transferência ── */}
      {transferirAluno && (
        <TransferModal
          aluno={transferirAluno}
          turmas={(turmaInfo ?? []).filter((t) => t.nomeTurma !== turmaNome)}
          onClose={() => setTransferirAluno(null)}
          onConfirm={(tipo, turmaDestino, dataTransf) => {
            transferirMut.mutate({
              alunoId: transferirAluno.id,
              tipo,
              turmaDestino: tipo === "Turma" ? turmaDestino : undefined,
              dataTransferencia: dataTransf,
            });
          }}
          isPending={transferirMut.isPending}
        />
      )}

      {/* ── Modal de Compensação de Faltas — Alunos < 75% ── */}
      <AbonoAlunosModal
        open={showAbonoAlunos}
        onClose={() => setShowAbonoAlunos(false)}
        alunos={(data?.alunos ?? []).filter((aluno) => {
          if (aluno.situacao !== "Matriculado") return false;
          const f = calcFreq(aluno.id);
          return f && f.pct < 75;
        })}
        calcFreq={calcFreq}
        onSelecionarAluno={(aluno) => {
          setAlunoParaAbonar(aluno);
          setShowAbonoAlunos(false);
        }}
      />

      {/* ── Modal de Seleção de Faltas do Aluno ── */}
      <AbonoDatasModal
        open={!!alunoParaAbonar}
        aluno={alunoParaAbonar}
        aulasComFalta={alunoParaAbonar ? (data?.aulas ?? [])
          .filter((a) => (data?.presencas?.[a.id]?.[alunoParaAbonar.id] ?? "P") === "F")
          .sort((a, b) => strToDate(a.data).getTime() - strToDate(b.data).getTime()) : []}
        onClose={() => {
          setAlunoParaAbonar(null);
          setShowAbonoAlunos(true); // volta para a lista de alunos
        }}
        onConfirm={(datas) => {
          const datasStr = datas.join(",");
          const url = `${BASE}/diarios/compensacao-ausencia?aluno=${encodeURIComponent(alunoParaAbonar.nomeCompleto)}&turma=${encodeURIComponent(turmaNome)}&professor=${encodeURIComponent(turma?.professorResponsavel || "")}&datas=${encodeURIComponent(datasStr)}&mes=${encodeURIComponent(MESES[mes - 1])}&ano=${ano}`;
          window.open(url, "_blank");
          setAlunoParaAbonar(null);
        }}
      />

      {/* ── Modal do FICAI ── */}
      <FicaiAlunosModal
        open={showFicaiModal}
        onClose={() => setShowFicaiModal(false)}
        alunos={ficaiAlunos.map((f) => f.aluno)}
        mes={MESES[mes - 1]}
        ano={String(ano)}
        turmaNome={turmaNome}
      />

      {/* ── Modal de Registro de Atividades ── */}
      {showAtividades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAtividades(false)} />
          <div className="relative z-10 bg-[#1a1b2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <FileText className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <h2 className="text-base font-bold text-white">Registro de Atividades</h2>
                <p className="text-xs text-gray-400">{turmaNome} · {atividades.length} aulas registradas</p>
              </div>
              <button
                onClick={() => setShowAtividades(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {atividades.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Nenhuma aula registrada ainda.
                </div>
              )}
              {atividades.map((aula) => {
                const [dd, mm, yyyy] = aula.data.split("/");
                const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dt.getDay()];
                const mudou = aula._editConteudo !== (aula.conteudo ?? "") || aula._editNA !== (aula.numeroAulas ?? 1);
                return (
                  <div key={aula.id} className="bg-white/5 border border-white/8 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{semana} {aula.data}</span>
                      <span className="text-xs text-gray-400 mr-auto">Nº de aulas:</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                          onClick={() => setAtividades((prev) => prev.map((a) => a.id === aula.id ? { ...a, _editNA: Math.max(1, a._editNA - 1) } : a))}
                        >−</button>
                        <span className="w-6 text-center text-sm font-bold text-white">{aula._editNA}</span>
                        <button
                          className="w-6 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                          onClick={() => setAtividades((prev) => prev.map((a) => a.id === aula.id ? { ...a, _editNA: a._editNA + 1 } : a))}
                        >+</button>
                      </div>
                    </div>
                    <textarea
                      className="w-full bg-white/8 border border-white/10 rounded-lg text-sm text-white p-2 resize-none placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 min-h-[64px]"
                      placeholder="Descreva o conteúdo / habilidades trabalhadas nesta aula..."
                      value={aula._editConteudo}
                      onChange={(e) => setAtividades((prev) => prev.map((a) => a.id === aula.id ? { ...a, _editConteudo: e.target.value } : a))}
                    />
                    <div className="flex justify-end">
                      <button
                        disabled={!mudou || aula._salvando}
                        onClick={() => salvarAtividade(aula.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          mudou && !aula._salvando
                            ? "bg-blue-600 hover:bg-blue-500 text-white"
                            : "bg-white/5 text-gray-600 cursor-not-allowed"
                        )}
                      >
                        {aula._salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {aula._salvando ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1cm; }

          /* Fundo branco, tinta preta */
          * {
            -webkit-print-color-adjust: economy !important;
            print-color-adjust: economy !important;
            color-adjust: economy !important;
          }

          html, body {
            background: #fff !important;
            color: #000 !important;
          }

          /* Ocultar elementos de UI */
          .no-print { display: none !important; }
          nav, aside, header:not(.print\\:block) { display: none !important; }

          /* Reset geral de fundos e cores */
          div, section, main, article, span, td, th, tr, table {
            background: transparent !important;
            color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          /* Cabeçalho da turma */
          .print\\:block {
            background: #fff !important;
            border-bottom: 2px solid #000 !important;
          }
          .print\\:text-black { color: #000 !important; }

          /* Tabela de presença */
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td {
            border: 1px solid #ccc !important;
            color: #000 !important;
            background: #fff !important;
          }
          thead th {
            background: #f3f4f6 !important;
            font-weight: bold !important;
            font-size: 9px !important;
          }

          /* Remover gradientes e glow */
          [style*="box-shadow"] { box-shadow: none !important; }

          /* Forçar fundo branco nos containers principais */
          .bg-\\[\\#0b0f1a\\], .bg-card, .bg-background,
          [class*="bg-"] { background: #fff !important; }

          /* Texto escuro para legibilidade */
          [class*="text-white"], [class*="text-gray"],
          [class*="text-slate"], [class*="text-muted"] {
            color: #333 !important;
          }

          /* Scrollable container - mostrar tudo */
          .overflow-x-auto, .overflow-y-auto, .overflow-auto {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Remover bordas coloridas */
          [class*="border-white"] { border-color: #ddd !important; }
          [class*="ring-"] { box-shadow: none !important; }

          /* Remover inline backgrounds/gradientes */
          [style*="background:"], [style*="background "] {
            background: transparent !important;
          }

          /* Badges de status */
          [class*="rounded-full"] {
            background: #f3f4f6 !important;
            color: #111 !important;
            border: 1px solid #ccc !important;
          }

          /* Células de presença P/F — vêm por ÚLTIMO para vencer os overrides acima */
          td[data-status="P"] {
            background: #f0fdf4 !important;
            color: #15803d !important;
          }
          td[data-status="P"] span {
            color: #15803d !important;
          }
          td[data-status="F"] {
            background: #fef2f2 !important;
            color: #b91c1c !important;
            font-weight: bold !important;
          }
          td[data-status="F"] span {
            color: #b91c1c !important;
          }
        }
      `}</style>
    </div>
    </AppLayout>
  );
}

/* ─── AlunoPerfilModal ─── */
function AlunoPerfilModal({
  aluno, cor, calcFreq, totalPresencas, diasUteisTotal, cancelPending, onClose, onTransferir, onCancelarTransferencia,
}: {
  aluno: Aluno;
  cor: string;
  calcFreq: (id: number) => { presencas: number; faltas: number; total: number; aulasPassadas: number; pct: number } | null;
  totalPresencas: (id: number) => number;
  diasUteisTotal: number;
  cancelPending: boolean;
  onClose: () => void;
  onTransferir: () => void;
  onCancelarTransferencia: () => void;
}) {
  const freq = calcFreq(aluno.id);
  const totalP = totalPresencas(aluno.id);
  const inicial = aluno.nomeCompleto.trim()[0]?.toUpperCase() ?? "?";
  const isExterno = aluno.situacao === "Transferido Externo";
  const isTurma = aluno.tipoTransferencia === "Turma";

  const freqCor = freq === null ? "#64748b"
    : freq.pct >= 75 ? "#10b981"
    : freq.pct >= 50 ? "#f59e0b"
    : "#ef4444";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm p-0 border border-white/10 bg-[#0f172a] overflow-hidden">
        {/* Wrapper interno com flex para não conflitar com grid do shadcn */}
        <div className="flex flex-col" style={{ maxHeight: "calc(90vh - 2rem)" }}>

          {/* Cabeçalho colorido — fixo */}
          <div
            className="px-6 pt-6 pb-5 flex items-center gap-4 shrink-0"
            style={{ background: `linear-gradient(135deg, ${cor}cc, ${cor}66)` }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
              style={{ background: "rgba(0,0,0,0.2)", color: "#fff" }}
            >
              {inicial}
            </div>
            <div className="min-w-0">
              <p className="text-white font-extrabold text-base leading-tight break-words">
                {aluno.nomeCompleto}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {aluno.turmaAtual && (
                  <span className="text-[11px] font-bold bg-black/25 text-white px-2 py-0.5 rounded-full">
                    {aluno.turmaAtual}
                  </span>
                )}
                {aluno.nivelEnsino && (
                  <span className="text-[11px] bg-black/20 text-white/80 px-2 py-0.5 rounded-full">
                    {aluno.nivelEnsino}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Corpo com scroll se necessário */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 shrink-0">Situação</span>
            {isExterno ? (
              <span className="text-xs font-bold bg-red-500/15 text-red-400 px-2.5 py-0.5 rounded-full">
                Transferido Externamente
                {aluno.dataTransferencia && ` · ${aluno.dataTransferencia}`}
              </span>
            ) : isTurma ? (
              <span className="text-xs font-bold bg-blue-500/15 text-blue-400 px-2.5 py-0.5 rounded-full">
                Transferido de {aluno.turmaOrigem}
              </span>
            ) : (
              <span className="text-xs font-bold bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full">
                Matriculado
              </span>
            )}
          </div>

          {/* Frequência do mês */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Frequência neste mês</p>
            {freq === null ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/4 border border-white/8">
                <span className="text-gray-500 text-xs italic">
                  Nenhum dia letivo registrado ainda.
                </span>
                {diasUteisTotal > 0 && (
                  <span className="ml-auto text-[11px] text-slate-500 shrink-0">
                    {diasUteisTotal} dias úteis no mês
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(freq.pct, 100)}%`,
                        background: freqCor,
                        boxShadow: `0 0 8px ${freqCor}66`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-black shrink-0" style={{ color: freqCor }}>
                    {freq.pct}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-emerald-400 font-bold">{totalP} presença{totalP !== 1 ? "s" : ""}</span>
                  <span className="text-red-400 font-bold">{freq.faltas} falta{freq.faltas !== 1 ? "s" : ""}</span>
                  <span className="text-gray-500">
                    {freq.aulasPassadas} de {freq.total} dias letivos
                  </span>
                </div>
                {freq.total < diasUteisTotal && (
                  <p className="text-[10px] text-slate-600 italic">
                    {diasUteisTotal - freq.total} dias úteis ainda sem aula registrada
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col gap-2 pt-1">
            <Link href={`/alunos/${aluno.id}`} onClick={onClose}>
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-white"
                style={{ background: cor, boxShadow: `0 4px 14px ${cor}44` }}
              >
                <ExternalLink className="w-4 h-4" />
                Ver perfil completo
              </button>
            </Link>

            {(isExterno || isTurma) ? (
              <button
                onClick={onCancelarTransferencia}
                disabled={cancelPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50"
              >
                {cancelPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelando...</>
                  : <><XCircle className="w-4 h-4" /> Cancelar Transferência</>
                }
              </button>
            ) : (
              <button
                onClick={onTransferir}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/8 border border-white/10 transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
                Registrar Transferência
              </button>
            )}
          </div>
          {/* fim botões */}
        </div>
        {/* fim corpo scrollável */}
      </div>
      {/* fim wrapper flex-col */}
    </DialogContent>
    </Dialog>
  );
}

/* ─── TransferModal ─── */
function TransferModal({
  aluno, turmas, onClose, onConfirm, isPending,
}: {
  aluno: Aluno;
  turmas: TurmaInfo[];
  onClose: () => void;
  onConfirm: (tipo: string, turmaDestino: string, data: string) => void;
  isPending: boolean;
}) {
  const hoje = getTodayStr();
  const [tipo, setTipo] = useState<"Externa" | "Turma">("Externa");
  const [turmaDestino, setTurmaDestino] = useState("");
  const [dataTransf, setDataTransf] = useState(hoje);

  function handleConfirm() {
    if (tipo === "Turma" && !turmaDestino) {
      alert("Selecione a turma de destino.");
      return;
    }
    onConfirm(tipo, turmaDestino, dataTransf);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-primary" />
            Registrar Transferência
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-gray-400">
            <span className="text-white font-semibold">{aluno.nomeCompleto}</span>
          </p>

          <div className="space-y-1.5">
            <Label>Tipo de Transferência</Label>
            <div className="flex gap-2">
              {(["Externa", "Turma"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                    tipo === t
                      ? "bg-primary border-primary text-white"
                      : "border-white/10 text-gray-400 hover:border-white/30"
                  )}
                >
                  {t === "Externa" ? "Transferido Externamente" : "Para outra turma"}
                </button>
              ))}
            </div>
          </div>

          {tipo === "Turma" && (
            <div className="space-y-1.5">
              <Label>Turma de Destino</Label>
              <select
                value={turmaDestino}
                onChange={(e) => setTurmaDestino(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Selecione a turma...</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.nomeTurma}>{t.nomeTurma} ({t.turno})</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Data da Transferência</Label>
            <Input
              type="text"
              placeholder="DD/MM/YYYY"
              value={dataTransf}
              onChange={(e) => setDataTransf(e.target.value)}
            />
          </div>

          {tipo === "Externa" && (
            <div className="rounded-lg bg-yellow-950/50 border border-yellow-800/40 p-3 text-xs text-yellow-300">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              O aluno ficará visível no diário como transferido, com cor diferenciada.
            </div>
          )}
          {tipo === "Turma" && (
            <div className="rounded-lg bg-blue-950/50 border border-blue-800/40 p-3 text-xs text-blue-300">
              <Info className="w-3.5 h-3.5 inline mr-1" />
              O aluno será realocado para a nova turma e suas presenças deste mês serão copiadas.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleConfirm} disabled={isPending} className="flex-1">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ icon, valor, label, cor }: { icon: React.ReactNode; valor: string; label: string; cor: string }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
      style={{ background: "rgba(0,0,0,0.18)", color: cor }}
    >
      {icon}
      <span className="font-bold">{valor}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

interface GridProps {
  alunos: Aluno[];
  aulas: Aula[];
  presencas: Record<number, Record<number, string>>;
  aulasMap: Record<string, Aula>;
  diasUteis: { dia: number; diaSemana: number; dataStr: string }[];
  cor: string;
  hojeStr: string;
  pendentes: Record<string, boolean>;
  onToggleDia: (dataStr: string) => void;
  onTogglePresenca: (aulaId: number, alunoId: number) => void;
  calcFreq: (alunoId: number) => { presencas: number; faltas: number; total: number; pct: number } | null;
  totalPresencas: (alunoId: number) => number;
  ficaiIds: Set<number>;
  onTransferir: (aluno: Aluno) => void;
  onVerPerfil: (aluno: Aluno) => void;
  mes: number;
  ano: number;
  turmaNome: string;
  onAbrirAbono: () => void;
}

function DiarioGrid({
  alunos, aulas, presencas, aulasMap, diasUteis, cor, hojeStr,
  pendentes, onToggleDia, onTogglePresenca, calcFreq, totalPresencas, ficaiIds, onTransferir, onVerPerfil,
  mes, ano, turmaNome, onAbrirAbono,
}: GridProps) {
  if (alunos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
        <Users className="w-12 h-12 opacity-30" />
        <p className="text-sm">Nenhum aluno matriculado nesta turma</p>
      </div>
    );
  }

  // Ordenar: matriculados primeiro, depois transferidos
  const alunosOrdenados = [...alunos].sort((a, b) => {
    const ordemA = a.situacao === "Matriculado" ? 0 : 1;
    const ordemB = b.situacao === "Matriculado" ? 0 : 1;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR");
  });

  return (
    <div>
      <table className="min-w-full border-collapse text-xs sm:text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "36px" }} />
          <col style={{ minWidth: "160px", width: "200px" }} />
          {diasUteis.map((d) => (
            <col key={d.dataStr} style={{ width: "38px" }} />
          ))}
          <col style={{ width: "54px" }} />
          <col style={{ width: "44px" }} />
          <col style={{ width: "90px" }} />
        </colgroup>

        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-30 text-center text-gray-500 font-semibold py-2 border-b border-r border-white/10"
              style={{ background: "#1e293b" }}
            >
              #
            </th>
            <th
              className="sticky left-9 top-0 z-30 text-left px-2 text-gray-400 font-semibold py-2 border-b border-r border-white/10"
              style={{ background: "#1e293b" }}
            >
              Nome do Aluno
            </th>
            {diasUteis.map((d) => {
              const isLetivo = !!aulasMap[d.dataStr];
              const isHoje = d.dataStr === hojeStr;
              return (
                <th
                  key={d.dataStr}
                  onClick={() => onToggleDia(d.dataStr)}
                  title={`${d.dataStr} (${DIAS_SEMANA_CURTO[d.diaSemana]}) — clique para ${isLetivo ? "remover" : "marcar"} como dia letivo`}
                  className={cn(
                    "sticky top-0 z-20 relative text-center py-2 border-b cursor-pointer select-none transition-all duration-200",
                    isHoje
                      ? "border-b-2 font-bold"
                      : isLetivo
                        ? "border-l-2 border-white/10 font-bold"
                        : "border-white/10 opacity-40 hover:opacity-80 font-medium"
                  )}
                  style={
                    isHoje
                      ? {
                          borderBottomColor: cor,
                          borderLeftColor: `${cor}60`,
                          borderLeftWidth: "2px",
                          color: "#ffffff",
                          background: `${cor}22`,
                          boxShadow: `0 0 12px 2px ${cor}33`,
                        }
                      : isLetivo
                        ? { borderLeftColor: cor, color: cor, background: "#1e293b" }
                        : { color: "#6b7280", background: "#1e293b" }
                  }
                >
                  {isHoje && (
                    <div
                      className="absolute top-0 left-0 right-0 text-[8px] font-black tracking-widest uppercase text-center leading-none pt-0.5"
                      style={{ color: cor }}
                    >
                      hoje
                    </div>
                  )}
                  <div className={cn("text-[11px] leading-none", isHoje && "mt-2")}>{DIAS_SEMANA_CURTO[d.diaSemana]}</div>
                  <div className="text-sm font-bold leading-tight mt-0.5">{d.dia}</div>
                  <div
                    className="h-1 rounded-full mx-auto mt-1"
                    style={{
                      width: isHoje ? "20px" : isLetivo ? "16px" : "0px",
                      background: isHoje ? cor : isLetivo ? cor : "transparent",
                      boxShadow: isHoje ? `0 0 6px ${cor}` : "none",
                      opacity: isLetivo || isHoje ? 1 : 0,
                    }}
                  />
                </th>
              );
            })}
            {/* Total P */}
            <th
              className="sticky top-0 z-20 text-center py-2 px-1 text-gray-400 font-bold border-b border-l-2 border-white/10"
              style={{ borderLeftColor: cor, background: "#1e293b" }}
              title="Total de Presenças no mês"
            >
              <div className="text-[10px] leading-none">Total</div>
              <div className="text-[10px] leading-none opacity-60">P</div>
            </th>
            {/* Freq % */}
            <th
              className="sticky top-0 z-20 text-center py-2 px-1 text-gray-400 font-bold border-b border-l border-white/10"
              style={{ background: "#1e293b" }}
              title="% Frequência (dias passados)"
            >
              <div className="text-[10px] leading-none">Freq</div>
              <div className="text-[10px] leading-none opacity-60">%</div>
            </th>
            {/* Transferência */}
            <th
              className="sticky top-0 z-20 text-center py-2 px-1 text-gray-400 font-bold border-b border-l border-white/10"
              style={{ background: "#1e293b" }}
              title="Situação / Transferência"
            >
              <div className="text-[10px] leading-none">Transf.</div>
            </th>
          </tr>
        </thead>

        <tbody>
          {alunosOrdenados.map((aluno, idx) => {
            const freq = calcFreq(aluno.id);
            const totalP = totalPresencas(aluno.id);
            const isExterno = aluno.situacao === "Transferido Externo";
            const isOutraTurma = aluno.tipoTransferencia === "Turma" && aluno.turmaAtual !== aluno.turmaOrigem;
            const veioDeOutraTurma = !!aluno.turmaOrigem && aluno.situacao === "Matriculado";
            const isFicai = ficaiIds.has(aluno.id);

            const rowBg = isExterno
              ? "rgba(239,68,68,0.06)"
              : isOutraTurma
                ? "rgba(59,130,246,0.06)"
                : idx % 2 === 0 ? "#1e293b" : "#1a2535";
            // Sticky cells precisam de bg sólido — rgba deixa conteúdo atrás transparecer ao rolar
            const stickyBg = isExterno
              ? "#201c1c"
              : isOutraTurma
                ? "#1a1e2c"
                : rowBg;
            const nomeOpacity = isExterno ? "opacity-50" : isOutraTurma ? "opacity-60" : "";
            const nomeCor = isExterno ? "text-red-400" : isOutraTurma ? "text-blue-400" : "text-gray-200";

            return (
              <tr
                key={aluno.id}
                className={cn(
                  "group border-b border-white/5",
                  isFicai ? "ring-1 ring-inset ring-orange-700/30" : ""
                )}
                style={{ background: rowBg }}
              >
                {/* # */}
                <td
                  className="sticky left-0 z-10 text-center text-gray-500 font-medium py-1.5 border-r border-white/10"
                  style={{ background: stickyBg }}
                >
                  {idx + 1}
                </td>

                {/* Nome */}
                <td
                  className={cn(
                    "sticky left-9 z-10 px-2 py-1.5 font-medium border-r border-white/10 truncate max-w-[200px]",
                    nomeOpacity
                  )}
                  style={{ background: stickyBg }}
                  title={`${aluno.nomeCompleto} — clique para ver perfil`}
                >
                  <button
                    onClick={() => onVerPerfil(aluno)}
                    className={cn(
                      "text-xs text-left w-full hover:underline transition-colors",
                      nomeCor,
                      isExterno ? "line-through" : ""
                    )}
                  >
                    {aluno.nomeCompleto}
                  </button>
                  {veioDeOutraTurma && (
                    <div className="text-[9px] text-blue-400/70 mt-0.5 flex items-center gap-0.5">
                      <ArrowRight className="w-2 h-2" /> veio de {aluno.turmaOrigem}
                    </div>
                  )}
                  {isFicai && !isExterno && !isOutraTurma && (
                    <div className="text-[9px] text-orange-400/80 mt-0.5 flex items-center gap-0.5">
                      <AlertTriangle className="w-2 h-2" /> FICAI
                    </div>
                  )}
                </td>

                {/* Células de presença */}
                {diasUteis.map((d) => {
                  const aula = aulasMap[d.dataStr];
                  const isHoje = d.dataStr === hojeStr;
                  if (!aula) {
                    return (
                      <td
                        key={d.dataStr}
                        className="text-center py-1.5 select-none"
                        style={isHoje ? { background: `${cor}15` } : undefined}
                      >
                        <span className="text-gray-800">—</span>
                      </td>
                    );
                  }
                  const key = `${aula.id}-${aluno.id}`;
                  const isPendente = pendentes[key];
                  const status = presencas[aula.id]?.[aluno.id] ?? "P";
                  const isP = status === "P";

                  return (
                    <td
                      key={d.dataStr}
                      data-status={status}
                      onClick={() => !isPendente && onTogglePresenca(aula.id, aluno.id)}
                      className={cn(
                        "text-center py-1.5 cursor-pointer select-none transition-all duration-150 border-l border-white/5",
                        isPendente ? "opacity-40" : "hover:scale-125"
                      )}
                      style={isHoje ? { background: `${cor}18` } : undefined}
                      title={isP ? "Presente — clique para marcar falta" : "Falta — clique para marcar presença"}
                    >
                      {isPendente ? (
                        <Loader2 className="w-3 h-3 mx-auto animate-spin text-gray-400" />
                      ) : isP ? (
                        <span className="text-base font-black leading-none" style={{ color: cor }}>·</span>
                      ) : (
                        <span className={cn("text-xs font-bold", isFicai ? "text-orange-400" : "text-red-400")}>F</span>
                      )}
                    </td>
                  );
                })}

                {/* Total Presenças */}
                <td
                  className="text-center py-1.5 px-1 font-bold border-l-2 border-white/10 text-xs"
                  style={{ borderLeftColor: cor, color: cor }}
                >
                  {totalP > 0 ? totalP : <span className="text-gray-600">—</span>}
                </td>

                {/* Frequência % */}
                <td className="text-center py-1.5 px-1 font-bold border-l border-white/10">
                  {freq ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={cn(
                        "text-xs font-bold",
                        freq.pct >= 75 ? "text-green-400" : freq.pct >= 50 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {freq.pct}%
                      </span>
                      <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            freq.pct >= 75 ? "bg-green-400" : freq.pct >= 50 ? "bg-yellow-400" : "bg-red-400"
                          )}
                          style={{ width: `${freq.pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>

                {/* Transferência */}
                <td className="text-center py-1.5 px-1 border-l border-white/10">
                  {aluno.dataTransferencia ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {isExterno ? (
                        <span className="text-[9px] font-bold text-red-400 leading-tight">Ext.</span>
                      ) : (
                        <span className="text-[9px] font-bold text-blue-400 leading-tight">
                          → {aluno.turmaDestino || aluno.turmaAtual}
                        </span>
                      )}
                      <span className="text-[9px] text-gray-500">{aluno.dataTransferencia}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onTransferir(aluno)}
                      className="text-gray-700 hover:text-gray-400 transition-colors"
                      title="Registrar transferência"
                    >
                      <ArrowUpDown className="w-3 h-3 mx-auto" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Rodapé de totais */}
        {aulas.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-white/20">
              <td className="sticky left-0 z-10" style={{ background: "#1e293b" }} />
              <td
                className="sticky left-9 z-10 px-2 py-2 text-xs font-bold text-gray-400 border-r border-white/10"
                style={{ background: "#1e293b" }}
              >
                Presenças por dia
              </td>
              {diasUteis.map((d) => {
                const aula = aulasMap[d.dataStr];
                if (!aula) return <td key={d.dataStr} />;
                const ativ = alunos.filter((a) => a.situacao === "Matriculado" || a.turmaOrigem);
                const pCount = ativ.filter((a) => (presencas[aula.id]?.[a.id] ?? "P") === "P").length;
                const fCount = ativ.length - pCount;
                return (
                  <td key={d.dataStr} className="text-center py-2 border-l border-white/5">
                    <div className="text-[10px] text-green-400 font-bold">{pCount}</div>
                    <div className="text-[10px] text-red-400">{fCount > 0 ? fCount : ""}</div>
                  </td>
                );
              })}
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </table>

      {/* Estado vazio */}
      {aulas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
          <BookOpen className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Nenhum dia letivo marcado neste mês</p>
          <p className="text-xs opacity-60">Clique nos dias acima para marcar os dias em que houve aula</p>
        </div>
      )}

      {/* Resumo de frequência */}
      {aulas.length > 0 && (
        <div className="p-4 sm:p-6">
          <ResumoFrequencia
            alunos={alunos.filter((a) => a.situacao === "Matriculado")}
            calcFreq={calcFreq}
            totalAulas={aulas.length}
            mes={mes}
            ano={ano}
            turmaNome={turmaNome}
            onAbrirAbono={onAbrirAbono}
          />
        </div>
      )}
    </div>
  );
}

function ResumoFrequencia({ alunos, calcFreq, totalAulas, mes, ano, turmaNome, onAbrirAbono }: {
  alunos: Aluno[];
  calcFreq: (id: number) => { pct: number; faltas: number; presencas: number; total: number } | null;
  totalAulas: number;
  mes: number;
  ano: number;
  turmaNome: string;
  onAbrirAbono: () => void;
}) {
  const emRisco = alunos.filter((a) => { const f = calcFreq(a.id); return f && f.pct < 75 && f.pct >= 50; });
  const reprovados = alunos.filter((a) => { const f = calcFreq(a.id); return f && f.pct < 50; });

  const reportUrl = `${BASE}/api/diario/relatorio-frequencia-mensal?mes=${mes}&ano=${ano}&turma=${encodeURIComponent(turmaNome)}`;

  return (
    <div className="space-y-4">
      {/* Card premium sugerindo o relatório de frequência mensal */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900/40 p-5 backdrop-blur-md transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-950/20">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-200">Resumo de Frequência Mensal</h4>
              <p className="text-xs text-blue-300/70 mt-0.5">
                Gere um relatório pronto para impressão e compartilhamento via WhatsApp com todos os alunos em situação crítica ou de risco.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Abrir Relatório (PDF)
            </a>
            {(emRisco.length > 0 || reprovados.length > 0) && (
              <button
                onClick={onAbrirAbono}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-950/40 hover:bg-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
              >
                <CalendarCheck className="w-4 h-4" />
                Compensar Faltas
              </button>
            )}
          </div>
        </div>
      </div>

      {reprovados.length > 0 && (
        <AlertaFreq
          titulo="Reprovados por falta (< 50%)"
          alunos={reprovados}
          calcFreq={calcFreq}
          cor="red"
          icon={<XCircle className="w-4 h-4 text-red-400" />}
        />
      )}
      {emRisco.length > 0 && (
        <AlertaFreq
          titulo="Em risco de reprovação (50–74%)"
          alunos={emRisco}
          calcFreq={calcFreq}
          cor="yellow"
          icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
        />
      )}
    </div>
  );
}

function AlertaFreq({ titulo, alunos, calcFreq, cor, icon }: {
  titulo: string;
  alunos: Aluno[];
  calcFreq: (id: number) => { pct: number; faltas: number } | null;
  cor: "red" | "yellow";
  icon: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-xl p-4 border",
      cor === "red" ? "bg-red-950/40 border-red-800/40" : "bg-yellow-950/40 border-yellow-800/40"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={cn("text-sm font-semibold", cor === "red" ? "text-red-300" : "text-yellow-300")}>
          {titulo}
        </span>
        <span className={cn("text-xs rounded-full px-2 py-0.5 font-bold",
          cor === "red" ? "bg-red-800/50 text-red-300" : "bg-yellow-800/50 text-yellow-300"
        )}>
          {alunos.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {alunos.map((a) => {
          const f = calcFreq(a.id);
          return (
            <div key={a.id} className={cn(
              "text-xs rounded-lg px-2.5 py-1 font-medium",
              cor === "red" ? "bg-red-900/50 text-red-200" : "bg-yellow-900/50 text-yellow-200"
            )}>
              {a.nomeCompleto.split(" ")[0]} {a.nomeCompleto.split(" ").slice(-1)[0]} — {f?.pct}%
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── AbonoAlunosModal ─── */
function AbonoAlunosModal({
  open,
  onClose,
  alunos,
  calcFreq,
  onSelecionarAluno,
}: {
  open: boolean;
  onClose: () => void;
  alunos: Aluno[];
  calcFreq: (id: number) => { pct: number; faltas: number; total: number } | null;
  onSelecionarAluno: (aluno: Aluno) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md border border-white/10 bg-[#0f172a] text-white p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-amber-500" />
            Compensação de Faltas (Anexo III)
          </DialogTitle>
          <p className="text-xs text-gray-400">
            Selecione um aluno com baixa frequência (&lt; 75%) para abonar suas faltas e emitir o documento.
          </p>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {alunos.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-500 italic">
              Nenhum aluno com frequência &lt; 75% neste mês.
            </p>
          ) : (
            alunos.map((a) => {
              const f = calcFreq(a.id);
              const pct = f?.pct ?? 0;
              const faltas = f?.faltas ?? 0;
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8 hover:border-white/15 transition-all">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-bold text-white truncate">{a.nomeCompleto}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Frequência: <span className={pct < 50 ? "text-red-400 font-bold" : "text-amber-400 font-bold"}>{pct}%</span> · {faltas} falta{faltas !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => onSelecionarAluno(a)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95"
                  >
                    Abonar
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── AbonoDatasModal ─── */
function AbonoDatasModal({
  open,
  aluno,
  aulasComFalta,
  onClose,
  onConfirm,
}: {
  open: boolean;
  aluno: Aluno | null;
  aulasComFalta: Aula[];
  onClose: () => void;
  onConfirm: (datas: string[]) => void;
}) {
  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSelecionadas({});
  }, [aluno]);

  if (!aluno) return null;

  const totalSelecionadas = Object.values(selecionadas).filter(Boolean).length;

  const toggleData = (dataStr: string) => {
    setSelecionadas((prev) => ({
      ...prev,
      [dataStr]: !prev[dataStr],
    }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const a of aulasComFalta) {
      next[a.data] = true;
    }
    setSelecionadas(next);
  };

  const deselectAll = () => {
    setSelecionadas({});
  };

  const handleGerar = () => {
    const datas = Object.entries(selecionadas)
      .filter(([_, sel]) => sel)
      .map(([d]) => d);
    onConfirm(datas);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md border border-white/10 bg-[#0f172a] text-white p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-amber-500" />
            Selecionar Faltas — {aluno.nomeCompleto.split(" ").slice(0, 2).join(" ")}
          </DialogTitle>
          <p className="text-xs text-gray-400">
            Selecione os dias de falta que deseja abonar na declaração de compensação.
          </p>
        </DialogHeader>

        {aulasComFalta.length > 1 && (
          <div className="flex gap-2 justify-end text-xs mt-2">
            <button onClick={selectAll} className="text-amber-400 hover:underline">Selecionar Todas</button>
            <span className="text-gray-600">|</span>
            <button onClick={deselectAll} className="text-gray-400 hover:underline">Limpar</button>
          </div>
        )}

        <div className="mt-2 max-h-[50vh] overflow-y-auto space-y-1.5 pr-1 py-1">
          {aulasComFalta.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-500 italic">
              Nenhuma falta registrada para este aluno no mês selecionado.
            </p>
          ) : (
            aulasComFalta.map((aula) => {
              const [dd, mm, yyyy] = aula.data.split("/");
              const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
              const semana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][dt.getDay()];
              const isChecked = !!selecionadas[aula.data];

              return (
                <label
                  key={aula.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                    isChecked
                      ? "bg-amber-600/10 border-amber-500/40 text-amber-200"
                      : "bg-white/5 border-white/8 hover:border-white/12 text-gray-300"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleData(aula.data)}
                    className="rounded border-white/20 bg-white/10 text-amber-600 focus:ring-amber-500 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{aula.data}</p>
                    <p className="text-xs opacity-70">{semana}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95"
          >
            Voltar
          </button>
          <button
            disabled={totalSelecionadas === 0}
            onClick={handleGerar}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95",
              totalSelecionadas > 0
                ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-950/40"
                : "bg-white/5 text-gray-500 cursor-not-allowed"
            )}
          >
            Gerar compensação de faltas
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── FicaiAlunosModal ─── */
function FicaiAlunosModal({
  open,
  onClose,
  alunos,
  mes,
  ano,
  turmaNome,
}: {
  open: boolean;
  onClose: () => void;
  alunos: Aluno[];
  mes: string;
  ano: string;
  turmaNome: string;
}) {
  const [selecionados, setSelecionados] = useState<Record<number, boolean>>({});
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);

  useEffect(() => {
    const initial: Record<number, boolean> = {};
    for (const a of alunos) {
      initial[a.id] = true;
    }
    setSelecionados(initial);
  }, [alunos, open]);

  const totalSelecionados = Object.values(selecionados).filter(Boolean).length;
  const todosSelecionados = alunos.length > 0 && totalSelecionados === alunos.length;

  const toggleAll = () => {
    const next: Record<number, boolean> = {};
    if (!todosSelecionados) {
      for (const a of alunos) {
        next[a.id] = true;
      }
    }
    setSelecionados(next);
  };

  const toggleAluno = (id: number) => {
    setSelecionados((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getSelectedIds = () => {
    return Object.entries(selecionados)
      .filter(([_, sel]) => sel)
      .map(([id]) => Number(id));
  };

  const handleVisualizar = () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    const url = `${BASE}/diarios/ficai?ids=${ids.join(",")}&mes=${encodeURIComponent(mes)}&ano=${ano}`;
    window.open(url, "_blank");
  };

  const handleImprimirLocal = () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    const url = `${BASE}/diarios/ficai?ids=${ids.join(",")}&mes=${encodeURIComponent(mes)}&ano=${ano}&print=true`;
    window.open(url, "_blank");
  };

  const handlePrintRicoh = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    setImprimindoRicoh(true);
    try {
      const promises = ids.map(id =>
        fetch(`${BASE}/api/alunos/${id}`, { credentials: "include" }).then(res => {
          if (!res.ok) throw new Error(`Erro ao carregar dados do aluno ${id}`);
          return res.json();
        })
      );
      const fullAlunos = await Promise.all(promises);

      const htmlContent = fullAlunos.map(aluno => {
        const formatCPF = (c: string | null | undefined) => {
          if (!c) return "____________________";
          const clean = c.replace(/\D/g, "");
          if (clean.length !== 11) return c;
          return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`;
        };

        const getAnoEscolaridade = (tName: string | null | undefined) => {
          if (!tName) return null;
          const upper = tName.toUpperCase();
          if (upper.includes("P1") || upper.includes("PRE 1") || upper.includes("PRÉ 1") || upper.includes("PRÉ I")) return "P1";
          if (upper.includes("P2") || upper.includes("PRE 2") || upper.includes("PRÉ 2") || upper.includes("PRÉ II")) return "P2";
          if (upper.includes("1º") || upper.includes("1O ") || upper.includes("1 AN")) return "1º";
          if (upper.includes("2º") || upper.includes("2O ") || upper.includes("2 AN")) return "2º";
          if (upper.includes("3º") || upper.includes("3O ") || upper.includes("3 AN")) return "3º";
          if (upper.includes("4º") || upper.includes("4O ") || upper.includes("4 AN")) return "4º";
          if (upper.includes("5º") || upper.includes("5O ") || upper.includes("5 AN")) return "5º";
          if (upper.includes("6º") || upper.includes("6O ") || upper.includes("6 AN")) return "6º";
          if (upper.includes("7º") || upper.includes("7O ") || upper.includes("7 AN")) return "7º";
          if (upper.includes("8º") || upper.includes("8O ") || upper.includes("8 AN")) return "8º";
          if (upper.includes("9º") || upper.includes("9O ") || upper.includes("9 AN")) return "9º";
          if (upper.includes("EJA") || upper.includes("FASE")) return "EJA";
          return null;
        };

        const anoEscolaridade = getAnoEscolaridade(aluno.turmaAtual || turmaNome);
        const dataAtual = new Date();
        const diaStr = String(dataAtual.getDate()).padStart(2, "0");
        const mesStr = MESES[dataAtual.getMonth()];
        const anoStr = String(dataAtual.getFullYear());
        
        const formattedCpf = formatCPF(aluno.cpf);
        const etnia = aluno.etnia || "________________";
        const telefone = aluno.telefone || "________________";
        const filiacao = [
          aluno.nomeMae ? `Mãe: ${aluno.nomeMae}` : "",
          aluno.nomePai ? `Pai: ${aluno.nomePai}` : ""
        ].filter(Boolean).join(" / ") || "________________________________________________";
        const responsavel = aluno.responsavel || "________________________________________________";
        const endereco = aluno.endereco || "________________________________________________";
        
        let bairro = "________________";
        if (aluno.endereco) {
          const match = aluno.endereco.match(/bairro\s*:?\s*([^,;]+)/i);
          if (match) {
            bairro = match[1].trim();
          }
        }

        const checkboxesHtml = ["P1", "P2", "1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º", "EJA"].map((anoItem) => {
          const isChecked = anoEscolaridade === anoItem;
          return `
            <div style="display: inline-flex; align-items: center; margin-right: 16px; margin-bottom: 8px; font-weight: 500;">
              <span class="checkbox-box">${isChecked ? "X" : ""}</span>
              <span style="margin-left: 6px;">${anoItem}</span>
            </div>
          `;
        }).join("");

        const cabecalhoHtml = obterCabecalhoHTML(undefined, `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>FICHA DE COMUNICAÇÃO DE ALUNO INFREQUENTE</span>
            <span style="font-size: 9pt; font-weight: 950; text-transform: uppercase; background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; margin: 0;">FICAI - 2026</span>
          </div>
        `);

        return `
          <div class="student-ficai-doc" style="width: 100%; page-break-after: always; box-sizing: border-box; padding: 1.5cm; min-height: 29.7cm;">
            <!-- PAGE 1: DADOS DO ALUNO E DADOS DA ESCOLA -->
            <div class="ficai-page" style="background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
              <div>
                ${cabecalhoHtml}

                <h2 style="text-align: center; font-weight: bold; font-size: 11pt; text-transform: uppercase; margin-bottom: 16px; line-height: 1.4;">
                  FICHA DE COMUNICAÇÃO DE ALUNO INFREQUENTE<br/>
                  <span style="font-size: 9.5pt; font-weight: 600;">EDUCAÇÃO INFANTIL / ENSINO FUNDAMENTAL I, II E EJA</span>
                </h2>

                <!-- Informações Básicas -->
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 8px; font-size: 9pt; margin-bottom: 16px; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <div>
                    <span style="font-weight: bold;">Mês de Referência:</span>
                    <p style="text-decoration: underline; text-decoration-style: dotted; font-weight: 600; margin: 4px 0 0 0;">${mes}</p>
                  </div>
                  <div>
                    <span style="font-weight: bold;">Escola Municipal:</span>
                    <p style="font-weight: 600; margin: 4px 0 0 0;">José Giró Faísca</p>
                  </div>
                  <div>
                    <span style="font-weight: bold;">Articulador(a):</span>
                    <p style="font-weight: 600; margin: 4px 0 0 0;">Karine Trajano Silveira Martins</p>
                  </div>
                  <div>
                    <span style="font-weight: bold;">Tel. Articulador(a):</span>
                    <p style="font-weight: 600; margin: 4px 0 0 0;">(22) 99847-9624</p>
                  </div>
                </div>

                <p style="font-size: 8pt; font-style: italic; color: #64748b; margin-bottom: 16px; text-align: center;">
                  A frequência deverá ser consultada no Sistema Unificado de Administração Pública (SUAP).
                </p>

                <!-- Dados do Aluno -->
                <div style="border: 1px solid #000; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 9pt;">
                  <h3 style="font-weight: bold; font-size: 9.5pt; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; margin: 0 0 12px 0;">1 - DADOS DO ALUNO(A):</h3>
                  
                  <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Nome:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${aluno.nomeCompleto}</p>
                    </div>
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Data de Nascimento:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${aluno.dataNascimento || "___/___/______"}</p>
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div>
                      <span style="color: #64748b; font-weight: 600;">CPF do aluno:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${formattedCpf}</p>
                    </div>
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Cor/Raça:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${etnia}</p>
                    </div>
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Telefone:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${telefone}</p>
                    </div>
                  </div>

                  <div style="margin-bottom: 12px;">
                    <span style="color: #64748b; font-weight: 600;">Filiação (Mãe/Pai):</span>
                    <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${filiacao}</p>
                  </div>

                  <div style="margin-bottom: 12px;">
                    <span style="color: #64748b; font-weight: 600;">Responsável pelo aluno(a):</span>
                    <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${responsavel}</p>
                  </div>

                  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Endereço:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${endereco}</p>
                    </div>
                    <div>
                      <span style="color: #64748b; font-weight: 600;">Bairro:</span>
                      <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">${bairro}</p>
                    </div>
                  </div>

                  <div>
                    <span style="color: #64748b; font-weight: 600;">Ponto de referência:</span>
                    <p style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin: 4px 0 0 0;">____________________________________________________________________</p>
                  </div>
                </div>

                <!-- Ano de Escolaridade -->
                <div style="border: 1px solid #000; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 9pt;">
                  <h3 style="font-weight: bold; font-size: 9.5pt; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; margin: 0 0 12px 0;">2 - ANO DE ESCOLARIDADE:</h3>
                  <div style="display: flex; flex-wrap: wrap;">
                    ${checkboxesHtml}
                  </div>
                </div>

                <!-- Relato Busca Ativa -->
                <div style="border: 1px solid #000; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 9pt;">
                  <h3 style="font-weight: bold; font-size: 9.5pt; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; margin: 0 0 12px 0;">3 - RELATO DO ARTICULADOR / DIRETOR REFERENTE À BUSCA ATIVA:</h3>
                  <div>
                    <div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>
                    <div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>
                    <div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>
                    <div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>
                    <div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>
                  </div>
                </div>

                <!-- Motivos Identificados -->
                <div style="border: 1px solid #000; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 9pt;">
                  <h3 style="font-weight: bold; font-size: 9.5pt; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; margin: 0 0 8px 0;">4 - MOTIVOS IDENTIFICADOS PELA ESCOLA ENCAMINHADOS AO SERVIÇO SOCIAL:</h3>
                  <table class="motivos-table" style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt;">
                    <tbody>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; width: 3%;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; width: 47%; font-weight: 500;">1 - Trabalho infantojuvenil</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; width: 3%;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; width: 47%; font-weight: 500;">7 - Aluno(a) com suspeita de envolvimento com substâncias ilícitas ou com envolvimento no tráfico</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">2 - Evasão do aluno do núcleo familiar</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">8 - Possível situação de suspeita de exploração e abuso sexual.</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">3 - Gravidez da aluna na adolescência</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">9 - Violência sofrida pelo responsável ou membro familiar</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">4 - Possível negligence dos responsáveis relacionada a situação de saúde, maus tratos, compromisso com a frequência escolar, etc...</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">10 - Violência sofrida pelo(a) aluno(a) no ambiente familiar</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">5 - Faltas recorrentes pela necessidade de cuidar de familiares e/ou serviços domésticos</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">11 - Violência sofrida pelo aluno no ambiente escolar (física, psicológica, ameaça).</td>
                      </tr>
                      <tr>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"><span class="checkbox-box" style="width: 12px; height: 12px; border: 1px solid #000; display: inline-block;"></span></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top; font-weight: 500;">6 - Suspeita de envolvimento com substâncias ilícitas (por parte da família).</td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"></td>
                        <td style="border: 1px solid #000; padding: 5px; vertical-align: top;"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Assinaturas Parte 1 -->
              <div style="margin-top: 32px; font-size: 9pt; border-top: 1px solid #cbd5e1; padding-top: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; text-align: center;">
                  <div>
                    <p style="text-align: left; margin-bottom: 24px;">Campos dos Goytacazes, <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${diaStr}&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${mesStr}&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${anoStr}&nbsp;&nbsp;</span>.</p>
                    <div style="border-top: 1px solid #000; width: 80%; margin: 40px auto 4px auto;"></div>
                    <p style="font-weight: bold; font-size: 8pt; text-transform: uppercase; margin: 0;">Assinatura e Matrícula do/a Diretor/a</p>
                  </div>
                  <div>
                    <p style="text-align: left; margin-bottom: 24px;">Campos dos Goytacazes, <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${diaStr}&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${mesStr}&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;${anoStr}&nbsp;&nbsp;</span>.</p>
                    <div style="border-top: 1px solid #000; width: 80%; margin: 40px auto 4px auto;"></div>
                    <p style="font-weight: bold; font-size: 8pt; text-transform: uppercase; margin: 0;">Assinatura e Matrícula do/a Articulador/a</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- PAGE 2: RELATO DO ATENDIMENTO DO SERVIÇO SOCIAL -->
            <div class="ficai-page" style="background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; justify-content: space-between; page-break-before: always; height: 100%; box-sizing: border-box; padding-top: 1.5cm;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
                  <p style="font-size: 8.5pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin: 0;">Ficha FICAI - Serviço Social</p>
                  <p style="font-size: 8.5pt; font-weight: 600; color: #64748b; margin: 0;">Aluno: ${aluno.nomeCompleto}</p>
                </div>
                
                <h3 style="font-weight: bold; font-size: 10pt; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 16px; letter-spacing: 0.05em;">
                  RELATO DO ATENDIMENTO DO SERVIÇO SOCIAL:
                </h3>
                
                <div>
                  ${Array.from({ length: 26 }).map(() => '<div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>').join("")}
                </div>
              </div>

              <div style="margin-top: 32px; font-size: 9pt;">
                <div style="width: 50%; margin-left: auto; text-align: center;">
                  <p style="text-align: left; margin-bottom: 24px;">Campos dos Goytacazes, <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de 2026.</p>
                  <div style="border-top: 1px solid #000; width: 80%; margin: 40px auto 4px auto;"></div>
                  <p style="font-weight: bold; font-size: 8pt; text-transform: uppercase; margin: 0;">Assinatura do/a Assistente Social</p>
                </div>
              </div>
            </div>

            <!-- PAGE 3: MEDIDAS APLICADAS PELO CONSELHO TUTELAR -->
            <div class="ficai-page" style="background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; justify-content: space-between; page-break-before: always; height: 100%; box-sizing: border-box; padding-top: 1.5cm;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
                  <p style="font-size: 8.5pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin: 0;">Ficha FICAI - Conselho Tutelar</p>
                  <p style="font-size: 8.5pt; font-weight: 600; color: #64748b; margin: 0;">Aluno: ${aluno.nomeCompleto}</p>
                </div>
                
                <h3 style="font-weight: bold; font-size: 10pt; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 16px; letter-spacing: 0.05em;">
                  MEDIDAS APLICADAS PELO CONSELHO TUTELAR:
                </h3>
                
                <div>
                  ${Array.from({ length: 22 }).map(() => '<div style="border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px;"></div>').join("")}
                </div>
              </div>

              <div style="margin-top: 32px; font-size: 9pt;">
                <div style="width: 50%; margin-left: auto; text-align: center;">
                  <p style="text-align: left; margin-bottom: 24px;">Campos dos Goytacazes, <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de <span style="font-weight: bold; text-decoration: underline;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de 2026.</p>
                  <div style="border-top: 1px solid #000; width: 80%; margin: 40px auto 4px auto;"></div>
                  <p style="font-weight: bold; font-size: 8pt; text-transform: uppercase; margin: 0;">Assinatura do/a Conselheiro/a Tutelar</p>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("");

      const htmlDocument = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>FICAI - E.M. José Giró Faísca</title>
          <style>
            ${CABECALHO_CSS}
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
            .ficai-page { page-break-after: always; box-sizing: border-box; padding: 1.5cm; width: 100%; min-height: 29.7cm; font-family: Arial, Helvetica, sans-serif; }
            .ficai-page:last-child { page-break-after: avoid; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
            .border { border: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .p-2 { padding: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-4 { margin-top: 16px; }
            .w-full { width: 100%; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
            .flex-col { display: flex; flex-direction: column; }
            .justify-between { justify-content: space-between; }
            /* Estilo dos checkboxes e tabelas */
            table.motivos-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt; }
            table.motivos-table td { border: 1px solid #000; padding: 5px; vertical-align: top; }
            .checkbox-box { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; text-align: center; line-height: 10px; font-size: 8pt; font-weight: bold; }
            .line-row { border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const blob = new Blob([htmlDocument], { type: "text/html" });
      const file = new File([blob], `FICAI_${fullAlunos.map(a => a.nomeCompleto.split(" ")[0]).join("_")}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", "Articulador - Karine Trajano");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const res = await fetch(`${BASE}/api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao registrar impressão");

      toast({
        title: "Enviado com sucesso!",
        description: `${ids.length === 1 ? "A ficha" : "As fichas"} de FICAI foram enviadas para a fila da RICOH.`,
        variant: "default"
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Erro de conexão com a impressora.",
        variant: "destructive"
      });
    } finally {
      setImprimindoRicoh(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md border border-white/10 bg-[#0f172a] text-white p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Fichas FICAI
          </DialogTitle>
          <p className="text-xs text-gray-400">
            Selecione os alunos para gerar a ficha FICAI de 3 páginas correspondente ao mês de {mes} de {ano}.
          </p>
        </DialogHeader>

        {alunos.length > 1 && (
          <div className="flex gap-2 justify-end text-xs mt-2">
            <button onClick={toggleAll} className="text-orange-400 hover:underline">
              {todosSelecionados ? "Deselecionar Todos" : "Selecionar Todos"}
            </button>
          </div>
        )}

        <div className="mt-2 max-h-[40vh] overflow-y-auto space-y-1.5 pr-1 py-1">
          {alunos.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-500 italic">
              Nenhum aluno infrequente nesta turma.
            </p>
          ) : (
            alunos.map((aluno) => {
              const isChecked = !!selecionados[aluno.id];
              return (
                <label
                  key={aluno.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                    isChecked
                      ? "bg-orange-600/10 border-orange-500/40 text-orange-200"
                      : "bg-white/5 border-white/8 hover:border-white/12 text-gray-300"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleAluno(aluno.id)}
                    className="rounded border-white/20 bg-white/10 text-orange-600 focus:ring-orange-500 h-4 w-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{aluno.nomeCompleto}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-white/10">
          <div className="flex gap-3">
            <button
              onClick={handleVisualizar}
              disabled={totalSelecionados === 0 || imprimindoRicoh}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5",
                totalSelecionados > 0 && !imprimindoRicoh
                  ? "bg-slate-700 hover:bg-slate-600 border border-slate-600"
                  : "bg-white/5 text-gray-500 cursor-not-allowed"
              )}
            >
              <ExternalLink className="w-4 h-4" />
              Visualizar PDF
            </button>
            <button
              onClick={handleImprimirLocal}
              disabled={totalSelecionados === 0 || imprimindoRicoh}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-1.5",
                totalSelecionados > 0 && !imprimindoRicoh
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-white/5 text-gray-500 cursor-not-allowed"
              )}
            >
              <Printer className="w-4 h-4" />
              Imprimir Local
            </button>
          </div>
          <button
            onClick={handlePrintRicoh}
            disabled={totalSelecionados === 0 || imprimindoRicoh}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-bold text-white border transition-all active:scale-95 flex items-center justify-center gap-1.5 mt-1",
              totalSelecionados > 0 && !imprimindoRicoh
                ? "bg-slate-700 hover:bg-slate-600 border-white/10"
                : "bg-slate-800/40 border-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            {imprimindoRicoh ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {imprimindoRicoh ? "Enviando para RICOH..." : "Imprimir na RICOH"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

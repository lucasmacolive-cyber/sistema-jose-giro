import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarTurmas, useListarAlunos } from "@workspace/api-client-react";
import { Search, Loader2, Users, X, Printer, ChevronLeft, GraduationCap, ArrowRightLeft, Eye, EyeOff, FileText, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const COR_PADRAO = "#3b82f6";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Anel de frequência (inline) ─── */
function FreqRing({ pct, size = 56 }: { pct: number | null; size?: number }) {
  const cor = pct === null ? "#64748b" : pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = pct !== null ? (pct / 100) * circ : 0;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor}
        strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.6s ease", filter: `drop-shadow(0 0 5px ${cor}88)` }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={pct !== null ? 11 : 9} fontWeight="bold"
      >
        {pct !== null ? `${pct}%` : "—"}
      </text>
    </svg>
  );
}

/* ─── Helpers de transferência ──────────────────────────────────────────── */
function isTransferido(situacao?: string | null) {
  return situacao?.toLowerCase().startsWith("transferido") ?? false;
}

function formatarDataTransferencia(dt?: string | null) {
  if (!dt || dt === "-" || dt.trim() === "") return null;
  // Tenta parse de vários formatos
  const d = new Date(dt);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  return dt;
}

/* ─── Modal: lista de alunos de uma turma ───────────────────────────────── */
interface TurmaInfo {
  id: number;
  nomeTurma: string;
  professorResponsavel?: string | null;
  turno?: string | null;
  cor?: string;
  linkSuap?: string | null;
}

function ModalAlunosTurma({ turma, onClose, onUpdated }: { turma: TurmaInfo; onClose: () => void, onUpdated: () => void }) {
  const { me } = useGetMe();
  const isMaster = me?.perfil === "Master";
  const cor = turma.cor || COR_PADRAO;
  const { data: todosAlunos, isLoading } = useListarAlunos();
  const [mostrarTransferidos, setMostrarTransferidos] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLinkSuap, setEditLinkSuap] = useState(turma.linkSuap || "");

  async function salvarEdicao() {
    try {
      const res = await fetch(`${BASE}/api/turmas/${turma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkSuap: editLinkSuap })
      });
      if (res.ok) {
        setIsEditing(false);
        onUpdated();
      }
    } catch {}
  }

  const alunosDaTurma = (todosAlunos ?? []).filter(a => a.turmaAtual === turma.nomeTurma);

  const matriculados = alunosDaTurma
    .filter(a => !isTransferido(a.situacao) && (a.situacao?.toLowerCase() === "matriculado"))
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));

  const transferidos = alunosDaTurma
    .filter(a => isTransferido(a.situacao))
    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));

  const alunosVisiveis = mostrarTransferidos
    ? [...matriculados, ...transferidos]
    : matriculados;

  function imprimir() {
    const linhas = matriculados
      .map((a, i) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600">${a.nomeCompleto}</td></tr>`)
      .join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Lista ${turma.nomeTurma}</title>
    <style>@page{size:A4;margin:2cm} body{font-family:Arial,sans-serif;font-size:12pt} h1{font-size:16pt;margin-bottom:4px} p{margin:2px 0;font-size:10pt;color:#555} table{width:100%;border-collapse:collapse;margin-top:16px} th{background:#f5f5f5;padding:8px;border-bottom:2px solid #ddd;text-align:left;font-size:10pt} .no-print{margin-bottom:12px} @media print{.no-print{display:none}}</style>
    </head><body>
    <div class="no-print"><button onclick="window.print()" style="padding:8px 18px;cursor:pointer;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:14px">🖨️ Imprimir / Salvar PDF</button></div>
    <h1>${turma.nomeTurma}</h1>
    <p>Professor(a): <strong>${turma.professorResponsavel || "A definir"}</strong></p>
    <p>Turno: ${turma.turno || "—"} · ${matriculados.length} aluno(s)</p>
    <table><thead><tr><th>#</th><th>Nome do Aluno</th></tr></thead><tbody>${linhas}</tbody></table>
    <p style="margin-top:20px;font-size:9pt;color:#999">Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
    </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  function baixarPdfTurma() {
    if (matriculados.length === 0) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw   = doc.internal.pageSize.getWidth();
    const mg   = 14;
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES", mg, 10);
    doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA", mg, 14);
    doc.text("E. M. JOSÉ GIRÓ FAÍSCA", mg, 18);
    doc.setFont("helvetica", "normal");
    const info = [`TURMA: ${turma.nomeTurma}`];
    if (turma.professorResponsavel) info.push(`PROFESSOR(A): ${turma.professorResponsavel}`);
    if (turma.turno) info.push(`TURNO: ${turma.turno}`);
    info.push(`EMISSÃO: ${hoje}`);
    doc.text(info.join("     "), mg, 22);
    doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(mg, 24, pw - mg, 24);
    autoTable(doc, {
      head: [["Nº", "Nome do Aluno"]],
      body: matriculados.map((a, i) => [String(i + 1), a.nomeCompleto]),
      startY: 27,
      margin: { left: mg, right: mg },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 14, halign: "center" }, 1: { cellWidth: "auto" } },
      tableLineColor: 0, tableLineWidth: 0.1,
    });
    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`Lista_${turma.nomeTurma.replace(/\s+/g, "_")}_${dataStr}.pdf`);
  }

  function baixarExcelTurma() {
    if (matriculados.length === 0) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const linhas: (string | number)[][] = [
      ["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"],
      ["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"],
      ["E. M. JOSÉ GIRÓ FAÍSCA"],
      [`TURMA: ${turma.nomeTurma}${turma.professorResponsavel ? "     PROFESSOR(A): " + turma.professorResponsavel : ""}${turma.turno ? "     TURNO: " + turma.turno : ""}     EMISSÃO: ${hoje}`],
      [],
      ["Nº", "Nome do Aluno"],
      ...matriculados.map((a, i) => [i + 1, a.nomeCompleto]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 6 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    const nomePlan = turma.nomeTurma.slice(0, 31).replace(/[\\/?*[\]:]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, nomePlan);
    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Lista_${turma.nomeTurma.replace(/\s+/g, "_")}_${dataStr}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
        style={{ background: "#0f172a" }}
      >
        <div
          className="px-5 pt-5 pb-4 shrink-0"
          style={{ background: `linear-gradient(135deg, ${cor}33, ${cor}11)`, borderBottom: `1px solid ${cor}30` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-white shrink-0" style={{ background: cor }}>
                {turma.nomeTurma[0]}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold text-white leading-tight">{turma.nomeTurma}</h2>
                {turma.professorResponsavel && (
                  <p className="text-sm text-white/60 truncate">{turma.professorResponsavel}</p>
                )}
                {turma.turno && (
                  <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md mt-0.5 inline-block text-white/80" style={{ background: `${cor}40` }}>
                    {turma.turno}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isMaster && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white shrink-0">
                  <span className="text-xs font-bold mr-1">EDITAR</span>
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isEditing && (
            <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/10 space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-white/50 mb-1 block">Link do Diário no SUAP (PDF)</label>
                <Input 
                  value={editLinkSuap} 
                  onChange={e => setEditLinkSuap(e.target.value)} 
                  placeholder="Ex: https://suap.campos.rj.gov.br/edu/diario_pdf/..."
                  className="h-8 text-xs bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/50 hover:bg-white/10">Cancelar</button>
                <button onClick={salvarEdicao} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-lg">Salvar</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs font-bold text-white/60 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Turmas
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40">
                {isLoading ? "…" : `${matriculados.length} ativo${matriculados.length !== 1 ? "s" : ""}${transferidos.length > 0 ? ` · ${transferidos.length} transf.` : ""}`}
              </span>
              {/* Toggle mostrar transferidos */}
              {transferidos.length > 0 && (
                <button
                  onClick={() => setMostrarTransferidos(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    mostrarTransferidos
                      ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                      : "bg-white/5 border-white/15 text-white/50 hover:text-white/80"
                  }`}
                >
                  {mostrarTransferidos ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {mostrarTransferidos ? "Ocultar" : "Ver"} transferidos
                </button>
              )}
              <button
                onClick={imprimir}
                disabled={matriculados.length === 0}
                title="Abrir para imprimir / salvar PDF pelo navegador"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: `${cor}30`, color: "white", border: `1px solid ${cor}50` }}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
              <button
                onClick={baixarPdfTurma}
                disabled={matriculados.length === 0}
                title="Baixar PDF direto"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                onClick={baixarExcelTurma}
                disabled={matriculados.length === 0}
                title="Baixar planilha Excel"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: cor }} />
            </div>
          ) : alunosVisiveis.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-10 w-10 mx-auto text-white/10 mb-3" />
              <p className="text-white/30 text-sm">Nenhum aluno nesta turma</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Separador visual quando mostrando transferidos */}
              {mostrarTransferidos && transferidos.length > 0 && matriculados.length > 0 && (
                <AnimatePresence>
                  <motion.div
                    key="sep-ativos"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-3 py-1.5"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Matriculados</span>
                  </motion.div>
                </AnimatePresence>
              )}

              {matriculados.map((aluno, i) => (
                <Link key={aluno.id} href={`/alunos/${aluno.id}`}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                    onClick={onClose}
                  >
                    <span className="text-xs text-white/20 w-5 text-right shrink-0 font-mono">{i + 1}</span>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 opacity-80"
                      style={{ background: `${cor}40` }}
                    >
                      {aluno.nomeCompleto[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate group-hover:text-blue-300 transition-colors uppercase">
                        {aluno.nomeCompleto}
                      </p>
                    </div>
                    <GraduationCap className="h-4 w-4 text-white/10 group-hover:text-blue-400 transition-colors shrink-0" />
                  </div>
                </Link>
              ))}

              {/* Seção de transferidos */}
              {mostrarTransferidos && transferidos.length > 0 && (
                <AnimatePresence>
                  <motion.div
                    key="transferidos-section"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {matriculados.length > 0 && (
                      <div className="px-3 py-2 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-amber-500/20" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/60 flex items-center gap-1">
                            <ArrowRightLeft className="h-2.5 w-2.5" />
                            Transferidos
                          </span>
                          <div className="flex-1 h-px bg-amber-500/20" />
                        </div>
                      </div>
                    )}
                    {transferidos.map((aluno, i) => {
                      const dataTransf = formatarDataTransferencia((aluno as any).dataTransferencia);
                      const tipoTransf = (aluno as any).tipoTransferencia || aluno.situacao;
                      const ehExterno = aluno.situacao?.toLowerCase().includes("externo");
                      return (
                        <Link key={aluno.id} href={`/alunos/${aluno.id}`}>
                          <div
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group opacity-60 hover:opacity-80"
                            onClick={onClose}
                          >
                            <span className="text-xs text-white/10 w-5 text-right shrink-0 font-mono">{i + 1}</span>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                              style={{ background: ehExterno ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: ehExterno ? "#f87171" : "#fbbf24" }}
                            >
                              {aluno.nomeCompleto[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white/70 text-sm truncate uppercase line-through decoration-white/30">
                                {aluno.nomeCompleto}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                                  style={{
                                    background: ehExterno ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                                    color: ehExterno ? "#f87171" : "#fbbf24"
                                  }}
                                >
                                  {ehExterno ? "Externo" : "Interno"}
                                </span>
                                {dataTransf ? (
                                  <span className="text-[9px] text-white/30">Transf. em {dataTransf}</span>
                                ) : (
                                  <span className="text-[9px] text-white/20">Data não registrada</span>
                                )}
                              </div>
                            </div>
                            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" style={{ color: ehExterno ? "#f87171" : "#fbbf24", opacity: 0.5 }} />
                          </div>
                        </Link>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Página principal ──────────────────────────────────────────────────── */
export default function TurmasPage() {
  const { data: turmas, isLoading, mutate: mutateTurmas } = useListarTurmas();
  const { data: todosAlunos } = useListarAlunos();
  const [search, setSearch] = useState("");
  const [turmaAberta, setTurmaAberta] = useState<TurmaInfo | null>(null);
  const [freqPorTurma, setFreqPorTurma] = useState<Record<string, number | null>>({});

  const contagemPorTurma = (todosAlunos ?? []).reduce<Record<string, number>>((acc, a) => {
    if (a.turmaAtual && a.situacao?.toLowerCase() === "matriculado") {
      acc[a.turmaAtual] = (acc[a.turmaAtual] ?? 0) + 1;
    }
    return acc;
  }, {});

  useEffect(() => {
    fetch(`${BASE}/api/diario/frequencia-stats`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const map: Record<string, number | null> = {};
        for (const t of data.turmas ?? []) map[t.turma] = t.pct;
        setFreqPorTurma(map);
      })
      .catch(() => {});
  }, []);

  const filtered = (turmas ?? []).filter(
    (t) =>
      t.nomeTurma.toLowerCase().includes(search.toLowerCase()) ||
      (t.professorResponsavel ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.turno ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setTurmaAberta(null);
  }, []);
  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <AppLayout>
      <div className="space-y-8 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
            Turmas
          </h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} turma{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, professor ou turno..."
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
            {filtered.map((turma) => {
              const cor = (turma as any).cor || COR_PADRAO;
              const inicial = (turma.nomeTurma || "?")[0].toUpperCase();
              const professor = turma.professorResponsavel || "A definir";
              const turno = turma.turno || "—";
              const totalAlunos = contagemPorTurma[turma.nomeTurma] ?? 0;
              const pct = freqPorTurma[turma.nomeTurma] ?? null;

              return (
                <div
                  key={turma.id}
                  onClick={() => setTurmaAberta({ id: turma.id, nomeTurma: turma.nomeTurma, professorResponsavel: turma.professorResponsavel, turno: turma.turno, cor, linkSuap: (turma as any).linkSuap })}
                  className="flex items-center h-[90px] rounded-[50px_15px_15px_50px] p-2.5 cursor-pointer border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${cor}, ${cor}99)`,
                    boxShadow: `0 10px 25px ${cor}44`,
                  }}
                >
                  <div
                    className="w-[70px] h-[70px] rounded-full flex items-center justify-center font-black text-2xl mr-5 shrink-0 text-white uppercase"
                    style={{ background: "rgba(255,255,255,0.2)" }}
                  >
                    {inicial}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                    <span className="font-extrabold text-[1.3rem] text-white leading-tight tracking-tight">
                      {turma.nomeTurma}
                    </span>
                    <span className="text-[0.72rem] text-white/80 mt-0.5 truncate">{professor}</span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span
                        className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white uppercase tracking-wide"
                        style={{ background: "rgba(0,0,0,0.22)" }}
                      >
                        {turno}
                      </span>
                      <span
                        className="flex items-center gap-1 text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white uppercase tracking-wide"
                        style={{ background: "rgba(255,255,255,0.18)" }}
                      >
                        <Users className="h-2.5 w-2.5" />
                        {todosAlunos ? totalAlunos : "…"}
                      </span>
                    </div>
                  </div>
                  {/* Anel de frequência da turma */}
                  <div className="shrink-0 mr-2">
                    <FreqRing pct={pct} size={58} />
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground bg-card/20 rounded-2xl border border-white/5 border-dashed">
                <p>Nenhuma turma encontrada.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {turmaAberta && (
          <ModalAlunosTurma 
            turma={turmaAberta} 
            onClose={() => setTurmaAberta(null)} 
            onUpdated={() => {
              mutateTurmas();
              setTurmaAberta(null);
            }} 
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

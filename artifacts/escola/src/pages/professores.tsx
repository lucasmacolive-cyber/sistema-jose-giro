// @ts-nocheck
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarProfessores, useListarTurmas, useGetMe } from "@workspace/api-client-react";
import { Search, Loader2, X, Phone, Mail, Hash, BookOpen, Clock, User, Fingerprint, Calendar, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COR_PADRAO = "#3b82f6";

function misturarCores(cor1: string, cor2: string): string {
  const hex = (c: string) => parseInt(c.replace("#", "").slice(0, 6), 16);
  const r1 = (hex(cor1) >> 16) & 0xff, g1 = (hex(cor1) >> 8) & 0xff, b1 = hex(cor1) & 0xff;
  const r2 = (hex(cor2) >> 16) & 0xff, g2 = (hex(cor2) >> 8) & 0xff, b2 = hex(cor2) & 0xff;
  const r = Math.round((r1 + r2) / 2).toString(16).padStart(2, "0");
  const g = Math.round((g1 + g2) / 2).toString(16).padStart(2, "0");
  const b = Math.round((b1 + b2) / 2).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/* ─── Campo de informação do perfil ─────────────────────────────────────── */
function InfoField({ icon: Icon, label, value, cor }: { icon: any; label: string; value?: string | null; cor: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cor}25` }}>
        <Icon className="h-4 w-4" style={{ color: cor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-white break-words">{value}</p>
      </div>
    </div>
  );
}

/* ─── Modal de perfil do professor ─────────────────────────────────────── */
interface Prof {
  id: number; nome: string; cpf?: string | null; matricula?: string | null;
  turmaManha?: string | null; turmaTarde?: string | null; turno?: string | null;
  telefone?: string | null; vinculo?: string | null; email?: string | null;
  identificacaoCenso?: string | null; dataNascimento?: string | null;
  foto?: string | null;
}

function ModalPerfilProfessor({
  prof, corManha, corTarde, onClose, isMaster, me
}: { prof: Prof; corManha: string | null; corTarde: string | null; onClose: () => void; isMaster: boolean; me: any }) {
  const [imprimindo, setImprimindo] = useState(false);

  async function imprimirNaRicoh() {
    setImprimindo(true);
    try {
      const html = `
        <html>
        <head><meta charset="UTF-8"><style>body{font-family:Arial;padding:20px;} h1{border-bottom:2px solid #333;} .item{margin:10px 0;}</style></head>
        <body>
          <h1 style="text-align:center">PERFIL DO PROFESSOR</h1>
          <div class="item"><b>NOME:</b> ${prof.nome}</div>
          <div class="item"><b>MATRÍCULA:</b> ${prof.matricula || "—"}</div>
          <div class="item"><b>CPF:</b> ${prof.cpf || "—"}</div>
          <div class="item"><b>TURMA MANHÃ:</b> ${prof.turmaManha || "—"}</div>
          <div class="item"><b>TURMA TARDE:</b> ${prof.turmaTarde || "—"}</div>
          <div class="item"><b>VÍNCULO:</b> ${prof.vinculo || "—"}</div>
          <div class="item"><b>TELEFONE:</b> ${prof.telefone || "—"}</div>
          <div class="item"><b>EMAIL:</b> ${prof.email || "—"}</div>
        </body>
        </html>
      `;
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Professor_${prof.nome.replace(/\s+/g, "_")}.html`, { type: "text/html" });
      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);
      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      alert("Enviado para a RICOH!");
    } catch { alert("Erro ao imprimir."); }
    finally { setImprimindo(false); }
  }
  let corPrincipal: string;
  let background: string;
  if (corManha && corTarde) {
    const mix = misturarCores(corManha, corTarde);
    corPrincipal = mix;
    background = `linear-gradient(135deg, ${corManha}40, ${corTarde}40)`;
  } else if (corManha) {
    corPrincipal = corManha;
    background = `linear-gradient(135deg, ${corManha}40, ${corManha}15)`;
  } else if (corTarde) {
    corPrincipal = corTarde;
    background = `linear-gradient(135deg, ${corTarde}40, ${corTarde}15)`;
  } else {
    corPrincipal = COR_PADRAO;
    background = `linear-gradient(135deg, ${COR_PADRAO}40, ${COR_PADRAO}15)`;
  }

  const inicial = (prof.nome || "?")[0].toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
        style={{ background: "#0f172a" }}
      >
        {/* Cabeçalho */}
        <div className="px-6 pt-6 pb-5 shrink-0 relative" style={{ background }}>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white">
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar grande */}
            {prof.foto ? (
              <img
                src={prof.foto}
                alt={prof.nome}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-lg"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl text-white shrink-0 shadow-lg"
                style={{ background: corPrincipal }}
              >
                {inicial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1">Professor(a)</p>
              <h2 className="text-lg font-extrabold text-white leading-tight uppercase">{prof.nome}</h2>
              {prof.vinculo && (
                <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md mt-1.5 inline-block text-white/80"
                  style={{ background: `${corPrincipal}40` }}>
                  {prof.vinculo}
                </span>
              )}
            </div>
          </div>

          {/* Turmas em destaque */}
          {(prof.turmaManha || prof.turmaTarde) && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {prof.turmaManha && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: `${corManha ?? corPrincipal}50`, border: `1px solid ${corManha ?? corPrincipal}60` }}>
                  <BookOpen className="h-3.5 w-3.5 text-white/80" />
                  <span className="text-xs font-bold text-white">{prof.turmaManha}</span>
                  <span className="text-[10px] text-white/50">manhã</span>
                </div>
              )}
              {prof.turmaTarde && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: `${corTarde ?? corPrincipal}50`, border: `1px solid ${corTarde ?? corPrincipal}60` }}>
                  <BookOpen className="h-3.5 w-3.5 text-white/80" />
                  <span className="text-xs font-bold text-white">{prof.turmaTarde}</span>
                  <span className="text-[10px] text-white/50">tarde</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <InfoField icon={Hash}        label="Matrícula"            value={prof.matricula}           cor={corPrincipal} />
          <InfoField icon={User}        label="CPF"                  value={prof.cpf}                  cor={corPrincipal} />
          <InfoField icon={Clock}       label="Turno"                value={prof.turno}                cor={corPrincipal} />
          <InfoField icon={Phone}       label="Telefone"             value={prof.telefone}             cor={corPrincipal} />
          <InfoField icon={Mail}        label="E-mail"               value={prof.email}                cor={corPrincipal} />
          <InfoField icon={Calendar}    label="Data de Nascimento"   value={prof.dataNascimento}       cor={corPrincipal} />
          <InfoField icon={Fingerprint} label="Identificação Censo"  value={prof.identificacaoCenso}  cor={corPrincipal} />
          
          {isMaster && (
            <button
              onClick={imprimirNaRicoh}
              disabled={imprimindo}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black transition-all border border-white/10"
            >
              {imprimindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              IMPRIMIR PERFIL (RICOH)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Página principal ──────────────────────────────────────────────────── */
export default function ProfessoresPage() {
  const { data: professores, isLoading } = useListarProfessores();
  const { data: turmas } = useListarTurmas();
  const [search, setSearch] = useState("");
  // Armazena apenas o ID — o perfil sempre lê dados vivos da lista
  const [profAbertoId, setProfAbertoId] = useState<number | null>(null);
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";
  const profAberto = profAbertoId != null
    ? ((professores ?? []).find((p) => p.id === profAbertoId) ?? null)
    : null;

  const corPorTurma: Record<string, string> = {};
  (turmas ?? []).forEach((t: any) => {
    if (t.nomeTurma) corPorTurma[t.nomeTurma] = t.cor || COR_PADRAO;
  });

  const filtered = (professores ?? []).filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.matricula ?? "").includes(q) ||
      (p.turmaManha ?? "").toLowerCase().includes(q) ||
      (p.turmaTarde ?? "").toLowerCase().includes(q)
    );
  });

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setProfAbertoId(null);
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
            Professores
          </h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} professor{filtered.length !== 1 ? "es" : ""}
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
            {filtered.map((prof) => {
              const inicial = (prof.nome || "?")[0].toUpperCase();
              const corManha = prof.turmaManha ? (corPorTurma[prof.turmaManha] ?? COR_PADRAO) : null;
              const corTarde = prof.turmaTarde ? (corPorTurma[prof.turmaTarde] ?? COR_PADRAO) : null;

              let background: string;
              let sombra: string;
              let corBadge: string;

              if (corManha && corTarde) {
                background = `linear-gradient(135deg, ${corManha} 0%, ${corTarde} 100%)`;
                const mix = misturarCores(corManha, corTarde);
                sombra = `0 10px 25px ${mix}55`;
                corBadge = "rgba(0,0,0,0.25)";
              } else if (corManha) {
                background = `linear-gradient(135deg, ${corManha}, ${corManha}99)`;
                sombra = `0 10px 25px ${corManha}44`;
                corBadge = "rgba(0,0,0,0.2)";
              } else if (corTarde) {
                background = `linear-gradient(135deg, ${corTarde}, ${corTarde}99)`;
                sombra = `0 10px 25px ${corTarde}44`;
                corBadge = "rgba(0,0,0,0.2)";
              } else {
                background = `linear-gradient(135deg, ${COR_PADRAO}, ${COR_PADRAO}99)`;
                sombra = `0 10px 25px ${COR_PADRAO}33`;
                corBadge = "rgba(0,0,0,0.2)";
              }

              return (
                <div
                  key={prof.id}
                  onClick={() => setProfAbertoId(prof.id)}
                  className="flex items-center h-[90px] rounded-[50px_15px_15px_50px] p-2.5 cursor-pointer border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
                  style={{ background, boxShadow: sombra }}
                >
                  <div className="w-[70px] h-[70px] rounded-full mr-5 shrink-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
                    {prof.foto ? (
                      <img src={prof.foto} alt={prof.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-black text-2xl text-white uppercase">
                        {inicial}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                    <span className="font-extrabold text-[1.05rem] text-white whitespace-nowrap overflow-hidden text-ellipsis leading-tight uppercase">
                      {prof.nome}
                    </span>
                    <span className="text-[0.72rem] text-white/75 mt-0.5">
                      Mat. {prof.matricula ?? "—"}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {prof.turmaManha && (
                        <span className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white" style={{ background: corBadge }}>
                          {prof.turmaManha} <span className="opacity-60">manhã</span>
                        </span>
                      )}
                      {prof.turmaTarde && (
                        <span className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white" style={{ background: corBadge }}>
                          {prof.turmaTarde} <span className="opacity-60">tarde</span>
                        </span>
                      )}
                      {!prof.turmaManha && !prof.turmaTarde && (
                        <span className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white/60" style={{ background: corBadge }}>Sem turma</span>
                      )}
                    </div>
                  </div>
                  {corManha && corTarde && (
                    <div className="flex flex-col gap-1 mr-2 shrink-0">
                      <div className="w-2 h-6 rounded-full" style={{ background: corManha, opacity: 0.8 }} />
                      <div className="w-2 h-6 rounded-full" style={{ background: corTarde, opacity: 0.8 }} />
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground bg-card/20 rounded-2xl border border-white/5 border-dashed">
                <p>Nenhum professor encontrado.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de perfil */}
      <AnimatePresence>
        {profAberto && (
          <ModalPerfilProfessor
            prof={profAberto}
            corManha={profAberto.turmaManha ? (corPorTurma[profAberto.turmaManha] ?? COR_PADRAO) : null}
            corTarde={profAberto.turmaTarde ? (corPorTurma[profAberto.turmaTarde] ?? COR_PADRAO) : null}
            onClose={() => setProfAbertoId(null)}
            isMaster={isMaster}
            me={me}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

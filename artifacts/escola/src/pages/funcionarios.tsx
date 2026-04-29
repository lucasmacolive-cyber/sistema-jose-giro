// @ts-nocheck
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarFuncionarios, useGetMe } from "@workspace/api-client-react";
import { Search, Loader2, Briefcase, X, Phone, Hash, Calendar, Clock, Link2, Shield, User, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Paleta de cores para os balões (sem depender de cor salva no banco)
const PALETA = [
  "#f97316", "#8b5cf6", "#06b6d4", "#10b981", "#f43f5e",
  "#3b82f6", "#eab308", "#ec4899", "#14b8a6", "#a855f7",
];

function corFuncionario(id: number): string {
  return PALETA[id % PALETA.length];
}

/* ─── Campo de perfil ────────────────────────────────────────────────────── */
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

/* ─── Modal de perfil do funcionário ────────────────────────────────────── */
interface Funcionario {
  id: number; nomeCompleto: string; cpf?: string | null; matricula?: string | null;
  funcao?: string | null; turno?: string | null; telefoneContato?: string | null;
  contatoEmergencia?: string | null; dataAdmissao?: string | null;
  vinculo?: string | null; status?: string | null; foto?: string | null;
}

function ModalPerfilFuncionario({ func, cor, onClose, isMaster, me }: { func: Funcionario; cor: string; onClose: () => void; isMaster: boolean; me: any }) {
  const [imprimindo, setImprimindo] = useState(false);

  async function imprimirNaRicoh() {
    setImprimindo(true);
    try {
      const html = `
        <html>
        <head><meta charset="UTF-8"><style>body{font-family:Arial;padding:20px;} h1{border-bottom:2px solid #333;} .item{margin:10px 0;}</style></head>
        <body>
          <h1 style="text-align:center">PERFIL DO FUNCIONÁRIO</h1>
          <div class="item"><b>NOME:</b> ${func.nomeCompleto}</div>
          <div class="item"><b>MATRÍCULA:</b> ${func.matricula || "—"}</div>
          <div class="item"><b>CPF:</b> ${func.cpf || "—"}</div>
          <div class="item"><b>FUNÇÃO:</b> ${func.funcao || "—"}</div>
          <div class="item"><b>TURNO:</b> ${func.turno || "—"}</div>
          <div class="item"><b>VÍNCULO:</b> ${func.vinculo || "—"}</div>
          <div class="item"><b>TELEFONE:</b> ${func.telefoneContato || "—"}</div>
          <div class="item"><b>STATUS:</b> ${func.status || "Ativo"}</div>
        </body>
        </html>
      `;
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Funcionario_${func.nomeCompleto.replace(/\s+/g, "_")}.html`, { type: "text/html" });
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

  const inicial = func.nomeCompleto[0].toUpperCase();
  const ativo = (func.status ?? "Ativo").toLowerCase() === "ativo";

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
        {/* Botão fechar — fora do overflow-hidden para não ser cortado */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white z-20">
          <X className="h-5 w-5" />
        </button>

        {/* Header com hexágono visual diferente dos professores */}
        <div className="relative px-6 pt-6 pb-5 shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${cor}30, ${cor}08)`, borderBottom: `1px solid ${cor}25` }}>
          {/* Decoração geométrica */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: cor, transform: "translate(40%, -40%)" }} />
          <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full opacity-5" style={{ background: cor, transform: "translate(-30%, 40%)" }} />

          <div className="flex items-center gap-4 relative z-10">
            {/* Avatar estilo hexagonal (via border-radius personalizado) */}
            <div className="shrink-0 relative">
              {func.foto ? (
                <img
                  src={func.foto}
                  alt={func.nomeCompleto}
                  className="w-20 h-20 object-cover shadow-lg"
                  style={{ borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }}
                />
              ) : (
                <div
                  className="w-20 h-20 flex items-center justify-center font-black text-3xl text-white shadow-lg"
                  style={{
                    background: cor,
                    borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
                  }}
                >
                  {inicial}
                </div>
              )}
              <div
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0f172a] ${ativo ? "bg-emerald-400" : "bg-slate-500"}`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1">Funcionário(a)</p>
              <h2 className="text-lg font-extrabold text-white leading-tight uppercase">{func.nomeCompleto}</h2>
              {func.funcao && (
                <p className="text-sm font-medium mt-0.5" style={{ color: cor }}>{func.funcao}</p>
              )}
            </div>
          </div>

          {/* Badges de status */}
          <div className="flex gap-2 mt-4 flex-wrap relative z-10">
            {func.turno && (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg text-white"
                style={{ background: `${cor}40`, border: `1px solid ${cor}50` }}>
                <Clock className="h-3 w-3" />
                {func.turno}
              </span>
            )}
            {func.vinculo && (
              <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg text-white"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Link2 className="h-3 w-3" />
                {func.vinculo}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg ${ativo ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30"}`}>
              <Shield className="h-3 w-3" />
              {func.status || "Ativo"}
            </span>
          </div>
        </div>

        {/* Informações */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          <InfoField icon={Hash}     label="Matrícula"            value={func.matricula}          cor={cor} />
          <InfoField icon={User}     label="CPF"                  value={func.cpf}                cor={cor} />
          <InfoField icon={Phone}    label="Telefone"             value={func.telefoneContato}    cor={cor} />
          <InfoField icon={Phone}    label="Contato de Emergência" value={func.contatoEmergencia} cor={cor} />
          <InfoField icon={Calendar} label="Data de Admissão"     value={func.dataAdmissao}       cor={cor} />
          <InfoField icon={Hash}     label="Função"               value={func.funcao}             cor={cor} />
          
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
export default function FuncionariosPage() {
  const { data: funcionarios, isLoading } = useListarFuncionarios();
  const [search, setSearch] = useState("");
  const [funcAberto, setFuncAberto] = useState<Funcionario | null>(null);
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";

  const filtered = (funcionarios ?? []).filter((f) =>
    f.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
    (f.funcao ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setFuncAberto(null);
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
            Funcionários
          </h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {filtered.length} funcionário{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou função..."
            className="pl-11 h-12 bg-card/50 border-white/10 focus-visible:ring-primary/30 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-card/20 rounded-2xl border border-white/5 border-dashed">
            <Briefcase className="h-10 w-10 mx-auto text-white/10 mb-3" />
            <p className="text-white/30">
              {(funcionarios ?? []).length === 0
                ? "Nenhum funcionário cadastrado ainda."
                : "Nenhum funcionário encontrado."}
            </p>
            {(funcionarios ?? []).length === 0 && (
              <p className="text-white/20 text-xs mt-2">
                Acesse Ajustes → Editar Tabelas → Funcionários para cadastrar.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((func) => {
              const cor = corFuncionario(func.id);
              const inicial = func.nomeCompleto[0].toUpperCase();
              const ativo = (func.status ?? "Ativo").toLowerCase() === "ativo";

              return (
                <motion.div
                  key={func.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => setFuncAberto(func)}
                  className="flex items-center h-[90px] rounded-[50px_15px_15px_50px] p-2.5 cursor-pointer border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
                  style={{
                    background: `linear-gradient(135deg, ${cor}, ${cor}88)`,
                    boxShadow: `0 10px 25px ${cor}44`,
                  }}
                >
                  {/* Avatar com forma diferente (diamante visual via border-radius) */}
                  <div
                    className="w-[70px] h-[70px] mr-5 shrink-0 flex items-center justify-center font-black text-xl text-white uppercase relative"
                    style={{
                      background: func.foto ? "transparent" : "rgba(255,255,255,0.2)",
                      borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
                      overflow: "hidden",
                    }}
                  >
                    {func.foto ? (
                      <img src={func.foto} alt={func.nomeCompleto} className="w-full h-full object-cover" />
                    ) : inicial}
                    {ativo && (
                      <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white/50" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                    <span className="font-extrabold text-[1.05rem] text-white leading-tight truncate uppercase">
                      {func.nomeCompleto}
                    </span>
                    <span className="text-[0.72rem] text-white/80 mt-0.5 truncate">
                      {func.funcao || "Função não especificada"}
                    </span>
                    <div className="flex gap-1 mt-1.5">
                      {func.turno && (
                        <span className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white uppercase tracking-wide"
                          style={{ background: "rgba(0,0,0,0.22)" }}>
                          {func.turno}
                        </span>
                      )}
                      {func.vinculo && (
                        <span className="text-[0.6rem] font-black px-2 py-0.5 rounded-lg text-white uppercase tracking-wide"
                          style={{ background: "rgba(0,0,0,0.15)" }}>
                          {func.vinculo}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de perfil */}
      <AnimatePresence>
        {funcAberto && (
          <ModalPerfilFuncionario
            func={funcAberto}
            cor={corFuncionario(funcAberto.id)}
            onClose={() => setFuncAberto(null)}
            isMaster={isMaster}
            me={me}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

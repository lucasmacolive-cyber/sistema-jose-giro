import { AppLayout } from "@/components/layout/AppLayout";
import { useGetAluno, useListarAlunos, useListarTurmas, useGetMe } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, Camera, GraduationCap,
  User, Phone, MapPin, Loader2, ChevronLeft, ChevronRight,
  Hash, Calendar, FileText, Users, Activity, BookOpen, ChevronRight as Chevron,
  ArrowRightLeft, CalendarDays, Printer
} from "lucide-react";
import { motion } from "framer-motion";

const COR_PADRAO = "#3b82f6";

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}

function InfoItem({ icon: Icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-white truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

interface CardProps {
  titulo: string;
  icone: React.ElementType;
  cor: string;
  children: React.ReactNode;
}

function Card({ titulo, icone: Icone, cor, children }: CardProps) {
  return (
    <div className="bg-[#1a2332] rounded-2xl border border-white/[0.07] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5" style={{ background: `${cor}18` }}>
        <Icone className="h-4 w-4" style={{ color: cor }} />
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: cor }}>
          {titulo}
        </h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

export default function AlunoPerfilPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "0");
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";
  const [imprimindo, setImprimindo] = useState(false);

  const { data: aluno, isLoading, isError } = useGetAluno(id, {
    query: { enabled: !!id && !isNaN(id) },
  } as any);

  const { data: todosAlunos } = useListarAlunos();
  const { data: turmas } = useListarTurmas();

  // Mapa turmaName -> cor
  const corPorTurma: Record<string, string> = {};
  (turmas ?? []).forEach((t: any) => {
    if (t.nomeTurma) corPorTurma[t.nomeTurma] = t.cor || COR_PADRAO;
  });

  const cor = corPorTurma[aluno?.turmaAtual ?? ""] ?? COR_PADRAO;

  const listaIds = (todosAlunos ?? []).map((a) => a.id);
  const posicao = listaIds.indexOf(id);
  const anteriorId = posicao > 0 ? listaIds[posicao - 1] : null;
  const proximoId = posicao < listaIds.length - 1 ? listaIds[posicao + 1] : null;

  const inicial = (aluno?.nomeCompleto || "?")[0].toUpperCase();

  async function imprimirPerfilNaRicoh() {
    if (!aluno) return;
    setImprimindo(true);
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Perfil - ${aluno.nomeCompleto}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #000; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin-top: 20px; }
            .section h2 { font-size: 14px; text-transform: uppercase; border-bottom: 1px solid #ccc; }
            .item { margin-bottom: 8px; font-size: 13px; }
            .label { font-weight: bold; color: #666; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 20px;">
             <p style="font-size: 10px; margin: 0;">E. M. JOSÉ GIRÓ FAÍSCA</p>
             <h1 style="margin: 5px 0;">PERFIL DO ALUNO</h1>
          </div>
          <div class="section">
            <h2>DADOS ESCOLARES</h2>
            <div class="item"><span class="label">NOME:</span> ${aluno.nomeCompleto}</div>
            <div class="item"><span class="label">MATRÍCULA:</span> ${aluno.matricula || "—"}</div>
            <div class="item"><span class="label">TURMA:</span> ${aluno.turmaAtual || "—"}</div>
            <div class="item"><span class="label">TURNO:</span> ${aluno.turno || "—"}</div>
            <div class="item"><span class="label">SITUAÇÃO:</span> ${aluno.situacao || "—"}</div>
          </div>
          <div class="section">
            <h2>DADOS PESSOAIS</h2>
            <div class="item"><span class="label">DATA NASC.:</span> ${aluno.dataNascimento || "—"}</div>
            <div class="item"><span class="label">CPF:</span> ${aluno.cpf || "—"}</div>
            <div class="item"><span class="label">RG:</span> ${aluno.rg || "—"}</div>
          </div>
          <div class="section">
            <h2>FAMÍLIA E CONTATO</h2>
            <div class="item"><span class="label">MÃE:</span> ${aluno.nomeMae || "—"}</div>
            <div class="item"><span class="label">PAI:</span> ${aluno.nomePai || "—"}</div>
            <div class="item"><span class="label">TEL:</span> ${aluno.telefone || "—"}</div>
            <div class="item"><span class="label">ENDEREÇO:</span> ${aluno.endereco || "—"}</div>
          </div>
          <p style="margin-top: 40px; font-size: 10px; color: #999; text-align: center;">
            Documento gerado em ${new Date().toLocaleString("pt-BR")}
          </p>
        </body>
        </html>
      `;
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Perfil_${aluno.nomeCompleto.replace(/\s+/g, "_")}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar");
      alert("Enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar para impressão.");
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-8">

        {/* Barra de navegação */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/alunos")}
            className="flex items-center gap-2 text-sm font-bold text-primary border border-primary/30 bg-primary/5 hover:bg-primary hover:text-white px-4 py-2 rounded-xl transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            {posicao >= 0 && (
              <span className="text-xs text-muted-foreground">
                {posicao + 1} de {listaIds.length}
              </span>
            )}
            <button
              onClick={() => anteriorId && navigate(`/alunos/${anteriorId}`)}
              disabled={!anteriorId}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Aluno anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => proximoId && navigate(`/alunos/${proximoId}`)}
              disabled={!proximoId}
              className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Próximo aluno"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {isMaster && (
              <button
                onClick={imprimirPerfilNaRicoh}
                disabled={imprimindo}
                className="flex items-center gap-2 text-sm font-black bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-all border-2 border-white/5 ml-2"
              >
                {imprimindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                IMPRIMIR PERFIL (RICOH)
              </button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: cor }} />
          </div>
        )}

        {isError && (
          <div className="text-center py-20 text-muted-foreground text-lg">
            Aluno não encontrado.
          </div>
        )}

        {aluno && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* Hero Banner — cor da turma */}
            <div
              className="relative rounded-3xl overflow-hidden p-1 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
              style={{
                background: `linear-gradient(135deg, ${cor}, ${cor}66)`,
                boxShadow: `0 20px 50px ${cor}44`,
              }}
            >
              <div className="bg-black/20 rounded-[20px] p-6 flex items-center gap-6">

                {/* Foto placeholder */}
                <div className="relative shrink-0">
                  <div
                    className="w-28 h-28 rounded-2xl flex items-center justify-center font-black text-5xl text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
                  >
                    {inicial}
                  </div>
                  <div
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border-2 border-black/30 cursor-pointer hover:scale-110 transition-transform"
                    style={{ background: cor }}
                    title="Adicionar foto (em breve)"
                  >
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <p className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-1" style={{ letterSpacing: "-0.5px" }}>
                    {aluno.nomeCompleto}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {aluno.turmaAtual && (
                      <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                        {aluno.turmaAtual}
                      </span>
                    )}
                    {aluno.turno && (
                      <span className="bg-black/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {aluno.turno}
                      </span>
                    )}
                    {aluno.situacao && (() => {
                      const isTransf = aluno.situacao.toLowerCase().startsWith("transferido");
                      const isExt = aluno.situacao.toLowerCase().includes("externo");
                      return (
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1"
                          style={isTransf ? {
                            background: isExt ? "rgba(239,68,68,0.18)" : "rgba(245,158,11,0.18)",
                            color: isExt ? "#f87171" : "#fbbf24",
                            borderColor: isExt ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)",
                          } : { background: "rgba(255,255,255,0.1)", color: "white", borderColor: "rgba(255,255,255,0.2)" }}
                        >
                          {isTransf && <ArrowRightLeft className="h-3 w-3" />}
                          {aluno.situacao}
                        </span>
                      );
                    })()}
                  </div>
                  {aluno.matricula && (
                    <p className="text-white/60 text-xs mt-3 font-mono">
                      Matrícula: {aluno.matricula}
                    </p>
                  )}
                </div>

                {/* Navegação quick */}
                <div className="hidden md:flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => anteriorId && navigate(`/alunos/${anteriorId}`)}
                    disabled={!anteriorId}
                    className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => proximoId && navigate(`/alunos/${proximoId}`)}
                    disabled={!proximoId}
                    className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Banner de transferência */}
            {aluno.situacao?.toLowerCase().startsWith("transferido") && (() => {
              const isExt = aluno.situacao?.toLowerCase().includes("externo");
              const dataTransf = (aluno as any).dataTransferencia;
              const dataFormatada = dataTransf && dataTransf !== "-" && dataTransf.trim()
                ? (() => { const d = new Date(dataTransf); return isNaN(d.getTime()) ? dataTransf : d.toLocaleDateString("pt-BR"); })()
                : null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border px-5 py-4 flex items-center gap-4"
                  style={{
                    background: isExt ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                    borderColor: isExt ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: isExt ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)" }}
                  >
                    <ArrowRightLeft className="h-5 w-5" style={{ color: isExt ? "#f87171" : "#fbbf24" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: isExt ? "#f87171" : "#fbbf24" }}>
                      Aluno transferido — {isExt ? "Transferência Externa" : "Transferência Interna"}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {dataFormatada ? (
                        <span className="text-xs text-white/50 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Transferido em {dataFormatada}
                        </span>
                      ) : (
                        <span className="text-xs text-white/30">Data de transferência não registrada</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Cards de informações */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Card titulo="Dados Escolares" icone={GraduationCap} cor="#3b82f6">
                <InfoItem icon={Hash} label="Matrícula" value={aluno.matricula} />
                <InfoItem icon={Users} label="Turma" value={aluno.turmaAtual} />
                <InfoItem icon={GraduationCap} label="Turno" value={aluno.turno} />
                <InfoItem icon={FileText} label="Situação" value={aluno.situacao} />
              </Card>

              <Card titulo="Dados Pessoais" icone={User} cor="#8b5cf6">
                <InfoItem icon={User} label="Nome Completo" value={aluno.nomeCompleto} />
                <InfoItem icon={Calendar} label="Data de Nascimento" value={aluno.dataNascimento} />
                <InfoItem icon={FileText} label="CPF" value={aluno.cpf} />
                <InfoItem icon={FileText} label="RG" value={aluno.rg} />
              </Card>

              <Card titulo="Família e Contato" icone={Phone} cor="#10b981">
                <InfoItem icon={User} label="Nome da Mãe" value={aluno.nomeMae} />
                <InfoItem icon={User} label="Nome do Pai" value={aluno.nomePai} />
                <InfoItem icon={Phone} label="Telefone" value={aluno.telefone} />
                <InfoItem icon={MapPin} label="Endereço" value={aluno.endereco} />
              </Card>
            </div>

            {/* Atalho: Notas & Presenças */}
            <button
              onClick={() => navigate(`/notas-presencas/${aluno.id}`)}
              className="w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all group hover:scale-[1.01]"
              style={{
                background: `linear-gradient(135deg, #3b82f615, #10b98115)`,
                borderColor: `${cor}33`,
                boxShadow: `0 4px 20px ${cor}11`,
              }}
            >
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Notas & Presenças</p>
                  <p className="text-xs text-muted-foreground">Ver notas e frequência por bimestre</p>
                </div>
              </div>
              <Chevron className="h-5 w-5 text-muted-foreground group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

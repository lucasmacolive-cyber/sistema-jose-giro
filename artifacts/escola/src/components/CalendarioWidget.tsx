// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Cake, GraduationCap, UserCircle, Briefcase, CalendarDays, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

// ─── tipos ────────────────────────────────────────────────────────────────────
type Aniversariante = { nome: string; tipo: string; info: string; id?: number };
type Evento         = { tipo: string; descricao: string } | null;
type DiaEvento      = { aniversariantes: Aniversariante[]; evento: Evento };
type DadosMes       = Record<string, DiaEvento>;

// ─── constantes ───────────────────────────────────────────────────────────────
const MESES_PT  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                   "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_ABR  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_FULL = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira",
                   "Quinta-feira","Sexta-feira","Sábado"];
const MESES_GEN = ["janeiro","fevereiro","março","abril","maio","junho",
                   "julho","agosto","setembro","outubro","novembro","dezembro"];

// ─── helpers visuais ──────────────────────────────────────────────────────────
function eventoBg(tipo: string) {
  if (tipo === "feriado") return "bg-red-500/18";
  if (tipo === "recesso") return "bg-amber-500/15";
  if (tipo === "ferias")  return "bg-slate-600/30";
  return "";
}
function eventoRing(tipo: string) {
  if (tipo === "feriado") return "ring-1 ring-red-500/30";
  if (tipo === "recesso") return "ring-1 ring-amber-500/30";
  return "";
}
function eventoText(tipo: string) {
  if (tipo === "feriado") return "text-red-300";
  if (tipo === "recesso") return "text-amber-300";
  if (tipo === "ferias")  return "text-slate-400";
  return "text-white/70";
}
function eventoChip(tipo: string) {
  if (tipo === "feriado") return "bg-red-500/20 text-red-300 border-red-500/30";
  if (tipo === "recesso") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (tipo === "ferias")  return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return "bg-white/10 text-white/60 border-white/20";
}
function tipoIcon(tipo: string) {
  if (tipo === "aluno")      return <GraduationCap className="h-3 w-3 text-blue-400 shrink-0" />;
  if (tipo === "professor")  return <UserCircle className="h-3 w-3 text-violet-400 shrink-0" />;
  return                            <Briefcase className="h-3 w-3 text-amber-400 shrink-0" />;
}

// ─── Popup balloon ────────────────────────────────────────────────────────────
interface PopupProps {
  dia: number; mes: number; ano: number;
  info: DiaEvento;
  style: React.CSSProperties;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
function PopupBalloon({ dia, mes, ano, info, style, onClose, onMouseEnter, onMouseLeave }: PopupProps) {
  const dow = new Date(ano, mes - 1, dia).getDay();
  const temAniv = info.aniversariantes.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="absolute z-50 w-60 rounded-2xl border border-white/12 bg-[#181c2e]/97 shadow-2xl shadow-black/70 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-white/8">
        <div>
          <p className="text-[11px] font-black text-white/90 leading-tight">
            {dia} de {MESES_GEN[mes - 1]}
          </p>
          <p className="text-[10px] text-white/35 mt-0.5">{DIAS_FULL[dow]}</p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Evento escolar */}
      {info.evento && (
        <div className="px-4 py-2.5 border-b border-white/5">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border ${eventoChip(info.evento.tipo)}`}>
            <span className="text-[9px]">
              {info.evento.tipo === "feriado" ? "🔴" : info.evento.tipo === "recesso" ? "🟡" : "⚪"}
            </span>
            {info.evento.descricao}
          </div>
        </div>
      )}

      {/* Aniversariantes */}
      {temAniv && (
        <div className="px-4 py-2.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-pink-400/70 flex items-center gap-1 mb-2">
            <Cake className="h-2.5 w-2.5" />
            Aniversário{info.aniversariantes.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {info.aniversariantes.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                {tipoIcon(a.tipo)}
                <div className="min-w-0 flex-1">
                  {a.tipo === "aluno" && a.id ? (
                    <Link href={`/alunos/${a.id}`}>
                      <p className="text-[11px] font-semibold text-white/90 leading-tight truncate hover:text-sky-300 transition-colors cursor-pointer">
                        {a.nome}
                      </p>
                    </Link>
                  ) : (
                    <p className="text-[11px] font-semibold text-white/90 leading-tight truncate">{a.nome}</p>
                  )}
                  <p className="text-[9px] text-white/35 truncate">{a.info}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!temAniv && !info.evento && (
        <p className="px-4 py-3 text-[11px] text-white/30 text-center">Nenhum evento</p>
      )}
    </motion.div>
  );
}

// ─── Widget principal ─────────────────────────────────────────────────────────
export function CalendarioWidget() {
  const hoje      = new Date();
  const [ano, setAno]           = useState(hoje.getFullYear());
  const [mes, setMes]           = useState(hoje.getMonth() + 1);
  const [dados, setDados]       = useState<DadosMes>({});
  const [carregando, setCarreg] = useState(false);

  // Popup state
  const [diaAtivo, setDiaAtivo]       = useState<number | null>(null);
  const [popupStyle, setPopupStyle]   = useState<React.CSSProperties>({});
  const hideTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef                       = useRef<HTMLDivElement>(null);

  // ── carregar dados do mês ──────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setCarreg(true);
    setDiaAtivo(null);
    try {
      const r = await fetch(`${BASE_URL}api/calendario/mes?mes=${mes}&ano=${ano}`, {
        credentials: "include",
      });
      if (r.ok) setDados(await r.json());
      else setDados({});
    } catch { setDados({}); }
    setCarreg(false);
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── construir células da grade ─────────────────────────────────────────────
  const diasNoMes   = new Date(ano, mes, 0).getDate();
  const primeiroDia = new Date(ano, mes - 1, 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const ehHoje = (d: number) =>
    d === hoje.getDate() && mes === hoje.getMonth() + 1 && ano === hoje.getFullYear();

  // ── navegação ──────────────────────────────────────────────────────────────
  const prevMes = () => { if (mes === 1) { setMes(12); setAno(a => a - 1); } else setMes(m => m - 1); };
  const nextMes = () => { if (mes === 12) { setMes(1); setAno(a => a + 1); } else setMes(m => m + 1); };

  // ── popup: hover/click ─────────────────────────────────────────────────────
  const clearHideTimer = () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  const scheduleHide   = () => { clearHideTimer(); hideTimerRef.current = setTimeout(() => setDiaAtivo(null), 250); };

  const abrirPopup = useCallback((d: number, cellEl: HTMLElement) => {
    const info = dados[String(d)];
    if (!info?.aniversariantes?.length && !info?.evento) return;

    clearHideTimer();

    const container = gridRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const el = cellEl.getBoundingClientRect();

    const POPUP_W = 240;
    const POPUP_H = 180;
    const PAD     = 6;

    // Horizontal
    let left = el.left - cr.left + el.width / 2 - POPUP_W / 2;
    left = Math.max(PAD, Math.min(left, cr.width - POPUP_W - PAD));

    // Vertical: acima se não cabe abaixo
    const spaceBelow = cr.bottom - el.bottom;
    const top = spaceBelow >= POPUP_H + PAD
      ? el.bottom - cr.top + PAD
      : el.top - cr.top - POPUP_H - PAD;

    setPopupStyle({ position: "absolute", width: POPUP_W, left, top, zIndex: 50 });
    setDiaAtivo(prev => (prev === d ? null : d));
  }, [dados]);

  const fecharPopup = () => { clearHideTimer(); setDiaAtivo(null); };

  // ── estatísticas rápidas ───────────────────────────────────────────────────
  const totalAnivMes = Object.values(dados).reduce((s, d) => s + d.aniversariantes.length, 0);
  const totalFeriados = Object.values(dados).filter(d => d.evento?.tipo === "feriado").length;

  return (
    <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-xl">
      <CardHeader className="border-b border-white/5 pb-2.5 px-4 pt-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-sky-400" />
            <CardTitle className="text-sm">Calendário Letivo</CardTitle>
            {carregando && (
              <div className="w-2.5 h-2.5 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
            )}
          </div>

          {/* Indicadores rápidos */}
          <div className="flex items-center gap-2">
            {totalAnivMes > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-pink-400/80">
                <Cake className="h-2.5 w-2.5" />
                <span>{totalAnivMes} aniversário{totalAnivMes > 1 ? "s" : ""}</span>
              </div>
            )}
            {totalFeriados > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-red-400/70">
                <span className="text-[9px]">🔴</span>
                <span>{totalFeriados} feriado{totalFeriados > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          {/* Navegação mês */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={prevMes}
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold text-white min-w-[110px] text-center">
              {MESES_PT[mes - 1]} {ano}
            </span>
            <button
              onClick={nextMes}
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-2 px-2">
        {/* Grade */}
        <div ref={gridRef} className="relative" onClick={e => {
          if (!(e.target as HTMLElement).closest("[data-day-cell]")) fecharPopup();
        }}>
          {/* Cabeçalhos dias da semana */}
          <div className="grid grid-cols-7 mb-0.5">
            {DIAS_ABR.map((d, i) => (
              <div key={i} className={`text-center text-[9px] font-bold py-0.5
                ${i === 0 || i === 6 ? "text-white/20" : "text-white/35"}`}
              >{d}</div>
            ))}
          </div>

          {/* Células de dia */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="h-7" />;

              const info    = dados[String(d)];
              const evento  = info?.evento;
              const hasAniv = (info?.aniversariantes?.length ?? 0) > 0;
              const isAtivo = diaAtivo === d;
              const hj      = ehHoje(d);
              const dow     = new Date(ano, mes - 1, d).getDay();
              const isWeek  = dow === 0 || dow === 6;
              const hasEvts = hasAniv || !!evento;

              return (
                <div
                  key={i}
                  data-day-cell
                  onMouseEnter={e => { if (hasEvts) abrirPopup(d, e.currentTarget); }}
                  onMouseLeave={() => { if (hasEvts) scheduleHide(); }}
                  onClick={e => { e.stopPropagation(); if (hasEvts) abrirPopup(d, e.currentTarget); }}
                  className={`
                    relative h-7 flex flex-col items-center justify-center rounded
                    transition-all duration-150 select-none
                    ${hasEvts ? "cursor-pointer" : "cursor-default"}
                    ${evento ? `${eventoBg(evento.tipo)} ${eventoRing(evento.tipo)}` : ""}
                    ${isAtivo ? "ring-1 ring-sky-400/60 bg-sky-500/10 scale-105 z-10" : ""}
                    ${!isAtivo && hasEvts ? "hover:bg-white/8 hover:scale-105" : ""}
                    ${isWeek && !evento ? "opacity-35" : ""}
                  `}
                >
                  {/* Número do dia */}
                  {hj ? (
                    <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center shadow shadow-sky-500/50">
                      <span className="text-[9px] font-black text-white">{d}</span>
                    </div>
                  ) : (
                    <span className={`text-[10px] font-semibold leading-none ${
                      evento ? eventoText(evento.tipo) :
                      isWeek  ? "text-white/20" : "text-white/75"
                    }`}>{d}</span>
                  )}

                  {/* Pontos de evento */}
                  {(hasAniv || evento) && (
                    <div className="flex items-center gap-px mt-0.5">
                      {hasAniv && <div className="w-0.5 h-0.5 rounded-full bg-pink-400" />}
                      {evento?.tipo === "feriado" && <div className="w-0.5 h-0.5 rounded-full bg-red-400" />}
                      {evento?.tipo === "recesso" && <div className="w-0.5 h-0.5 rounded-full bg-amber-400" />}
                      {evento?.tipo === "ferias"  && <div className="w-0.5 h-0.5 rounded-full bg-slate-500" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Popup balloon */}
          <AnimatePresence>
            {diaAtivo !== null && dados[String(diaAtivo)] && (
              <PopupBalloon
                key={diaAtivo}
                dia={diaAtivo}
                mes={mes}
                ano={ano}
                info={dados[String(diaAtivo)]}
                style={popupStyle}
                onClose={fecharPopup}
                onMouseEnter={clearHideTimer}
                onMouseLeave={scheduleHide}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] text-white/45">
            <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center shadow-sky-500/40 shadow-md">
              <span className="text-[8px] font-black text-white">D</span>
            </div>
            Hoje
          </div>
          <LegendaItem dot="bg-pink-400 shadow-pink-500/40" label="Aniversário" />
          <LegendaItem dot="bg-red-400/80" label="Feriado" fundo="bg-red-500/15 ring-1 ring-red-500/25" />
          <LegendaItem dot="bg-amber-400/80" label="Recesso" fundo="bg-amber-500/12 ring-1 ring-amber-500/25" />
          <LegendaItem dot="bg-slate-400/60" label="Férias" fundo="bg-slate-500/20" />
          <p className="text-[9px] text-white/20 ml-auto">Passe o cursor para ver detalhes</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendaItem({ dot, label, fundo }: { dot: string; label: string; fundo?: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-white/45">
      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${fundo ?? ""}`}>
        <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${dot}`} />
      </div>
      {label}
    </div>
  );
}

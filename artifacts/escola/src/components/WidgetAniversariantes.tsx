import { useState, useEffect, useRef, useCallback } from "react";
import { Cake, ChevronDown, GraduationCap, UserCircle, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

export interface Aniversariante {
  id?: number;
  nome: string;
  tipo: "aluno" | "professor" | "funcionario";
  info: string;
  diaMes: string;
  diasAte: number;
}

interface DadosAniversario {
  hoje: Aniversariante[];
  semana: Aniversariante[];
  mes: Aniversariante[];
}

/* ─── Ícone por tipo ─────────────────────────────────────────────────────── */
function IconeTipo({ tipo }: { tipo: Aniversariante["tipo"] }) {
  if (tipo === "professor")   return <UserCircle className="h-3.5 w-3.5 text-violet-400" />;
  if (tipo === "funcionario") return <Briefcase  className="h-3.5 w-3.5 text-amber-400" />;
  return <GraduationCap className="h-3.5 w-3.5 text-blue-400" />;
}

function corTipo(tipo: Aniversariante["tipo"]) {
  if (tipo === "professor")   return "text-violet-300";
  if (tipo === "funcionario") return "text-amber-300";
  return "text-blue-300";
}

/* ─── Item na lista do dropdown ──────────────────────────────────────────── */
function ItemAniversariante({
  a,
  destaque,
  onClose,
}: {
  a: Aniversariante;
  destaque?: boolean;
  onClose?: () => void;
}) {
  const inner = (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
      destaque ? "bg-yellow-500/10" : "hover:bg-white/5"
    } ${a.tipo === "aluno" && a.id ? "cursor-pointer hover:bg-blue-500/10" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        destaque ? "bg-yellow-500/20" :
        a.tipo === "professor" ? "bg-violet-500/20" :
        a.tipo === "funcionario" ? "bg-amber-500/20" : "bg-blue-500/20"
      }`}>
        {destaque ? <Cake className="h-3.5 w-3.5 text-yellow-400" /> : <IconeTipo tipo={a.tipo} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate leading-tight ${
          a.tipo === "aluno" && a.id ? "text-white group-hover:text-blue-300 transition-colors" : "text-white"
        }`}>
          {a.nome}
        </p>
        <p className={`text-[10px] truncate leading-tight ${corTipo(a.tipo)}`}>{a.info}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!destaque && (
          <span className="text-[10px] font-bold text-white/30">{a.diaMes}</span>
        )}
        {a.tipo === "aluno" && a.id && (
          <span className="text-[9px] font-bold text-blue-400/60 border border-blue-400/20 rounded px-1 py-0.5 hidden group-hover:inline-block">
            ver perfil →
          </span>
        )}
      </div>
    </div>
  );

  if (a.tipo === "aluno" && a.id) {
    return (
      <Link
        href={`/alunos/${a.id}`}
        onClick={onClose}
        className="block group"
      >
        {inner}
      </Link>
    );
  }

  return <div>{inner}</div>;
}

/* ─── Ticker de hoje (marquee) ───────────────────────────────────────────── */
export function TickerAniversariantes({ lista }: { lista: Aniversariante[] }) {
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (lista.length <= 1) return;
    const timer = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % lista.length);
        setShow(true);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [lista.length]);

  if (!lista.length) return null;

  const pessoa = lista[idx];

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs">
      <Cake className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
      <AnimatePresence mode="wait">
        {show && (
          <motion.span
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-yellow-200 font-medium whitespace-nowrap"
          >
            🎂 <span className="font-bold">{pessoa.nome}</span>
            <span className="text-yellow-400/70 ml-1.5">· {pessoa.info}</span>
            {lista.length > 1 && (
              <span className="text-yellow-500/50 ml-2">{idx + 1}/{lista.length}</span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Dropdown flutuante ──────────────────────────────────────────────────── */
type Aba = "hoje" | "semana" | "mes";

function Dropdown({ dados, onClose }: { dados: DadosAniversario; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [aba, setAba] = useState<Aba>("hoje");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  const lista = dados[aba];
  const abas: { id: Aba; label: string; count: number; cor: string }[] = [
    { id: "hoje",   label: "Hoje",   count: dados.hoje.length,   cor: "text-yellow-400 border-yellow-400" },
    { id: "semana", label: "Semana", count: dados.semana.length,  cor: "text-blue-400 border-blue-400" },
    { id: "mes",    label: "Mês",    count: dados.mes.length,     cor: "text-purple-400 border-purple-400" },
  ];

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-72 z-50 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10 bg-[#1a2236]">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-transparent border-b border-white/5 flex items-center gap-2">
        <Cake className="h-4 w-4 text-yellow-400" />
        <span className="text-sm font-bold text-white">Aniversariantes</span>
      </div>

      {/* Abas */}
      <div className="flex border-b border-white/5">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 ${
              aba === a.id ? `${a.cor}` : "text-white/30 border-transparent hover:text-white/60"
            }`}
          >
            {a.label}
            {a.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                aba === a.id ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10 text-white/40"
              }`}>{a.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="max-h-64 overflow-y-auto py-1.5 px-1.5 space-y-0.5 scrollbar-thin">
        {lista.length === 0 ? (
          <div className="py-8 text-center">
            <Cake className="h-7 w-7 mx-auto text-white/10 mb-2" />
            <p className="text-xs text-white/30">Nenhum aniversariante</p>
          </div>
        ) : (
          lista.map((a, i) => (
            <ItemAniversariante
              key={`${a.tipo}-${a.nome}-${i}`}
              a={a}
              destaque={aba === "hoje"}
              onClose={onClose}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-white/5 border-t border-white/5 text-[10px] text-white/20 text-center">
        {dados.hoje.length + dados.semana.length + dados.mes.length} aniversariante(s) nos próximos 30 dias
      </div>
    </div>
  );
}

/* ─── Widget principal ───────────────────────────────────────────────────── */
export function WidgetAniversariantes() {
  const [dados, setDados] = useState<DadosAniversario | null>(null);
  const [aberto, setAberto] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}api/aniversariantes`, { credentials: "include" });
      if (r.ok) setDados(await r.json());
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 60 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  const totalHoje  = dados?.hoje.length ?? 0;
  const totalGeral = totalHoje + (dados?.semana.length ?? 0) + (dados?.mes.length ?? 0);

  return (
    <div className="relative" ref={btnRef}>
      <button
        onClick={() => setAberto(v => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 text-sm font-medium ${
          totalHoje > 0
            ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25"
            : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70"
        }`}
      >
        <Cake className={`h-4 w-4 shrink-0 ${totalHoje > 0 ? "text-yellow-400" : "text-white/30"}`} />
        <span className="hidden sm:inline">Aniversariantes</span>
        {totalGeral > 0 && (
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
            totalHoje > 0 ? "bg-yellow-500/30 text-yellow-300" : "bg-white/10 text-white/40"
          }`}>
            {totalHoje > 0 ? `${totalHoje} hoje` : totalGeral}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {aberto && dados && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <Dropdown dados={dados} onClose={() => setAberto(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

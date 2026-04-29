// @ts-nocheck
import { AppLayout } from "@/components/layout/AppLayout";
import { CalendarDays } from "lucide-react";

// ─── Tipos de dia ─────────────────────────────────────────────────────────────
type TipoDia =
  | "letivo" | "ferias" | "feriado" | "recesso"
  | "sl" | "cc" | "rp" | "inicio" | "termino"
  | "fim";

// ─── Dias especiais 2026 ──────────────────────────────────────────────────────
// Chave: "YYYY-MM-DD" → tipo
const ESPECIAL: Record<string, TipoDia> = {
  // FEVEREIRO — Reuniões pedagógicas + recesso de Carnaval
  "2026-02-02": "rp", "2026-02-03": "rp",
  "2026-02-04": "inicio",           // → início do semestre letivo
  "2026-02-16": "recesso", "2026-02-17": "recesso",
  "2026-02-18": "recesso", "2026-02-19": "recesso", "2026-02-20": "recesso",

  // ABRIL
  "2026-04-03": "feriado",          // Paixão de Cristo
  "2026-04-12": "sl",               // Sábado Letivo
  "2026-04-21": "feriado",          // Tiradentes
  "2026-04-23": "feriado",          // São Jorge
  "2026-04-24": "recesso",          // Ponte
  "2026-04-30": "cc",               // Conselho de Classe

  // MAIO
  "2026-05-01": "feriado",          // Dia do Trabalhador
  "2026-05-16": "sl",               // Sábado Letivo

  // JUNHO
  "2026-06-04": "feriado",          // Corpus Christi
  "2026-06-05": "recesso",          // Ponte
  "2026-06-27": "sl",               // Sábado Letivo

  // JULHO — fim 1º semestre, recesso e início 2º semestre
  "2026-07-09": "cc",               // Conselho de Classe
  "2026-07-10": "termino",          // ← Término do 1º semestre (letivo)
  "2026-07-13": "recesso", "2026-07-14": "recesso", "2026-07-15": "recesso",
  "2026-07-16": "recesso", "2026-07-17": "recesso",
  "2026-07-20": "recesso", "2026-07-21": "recesso", "2026-07-22": "recesso",
  "2026-07-23": "recesso", "2026-07-24": "recesso",
  "2026-07-27": "inicio",           // → Início 2º semestre (3º bimestre)

  // AGOSTO
  "2026-08-06": "feriado",          // Santíssimo Salvador
  "2026-08-22": "sl",               // Sábado Letivo

  // SETEMBRO
  "2026-09-07": "feriado",          // Independência do Brasil
  "2026-09-20": "sl",               // Sábado Letivo
  "2026-09-30": "cc",               // Conselho de Classe

  // OUTUBRO
  "2026-10-03": "sl",               // Sábado Letivo
  "2026-10-12": "feriado",          // N. Sra. Aparecida
  "2026-10-15": "recesso",          // Ponte
  "2026-10-24": "sl",               // Sábado Letivo

  // NOVEMBRO
  "2026-11-02": "feriado",          // Finados
  "2026-11-15": "feriado",          // Proclamação da República (cai Dom)
  "2026-11-20": "feriado",          // Consciência Negra

  // DEZEMBRO — Conselho de Classe + recesso de Natal
  "2026-12-18": "cc",               // Conselho de Classe / Conselho de Promoção
  "2026-12-21": "recesso", "2026-12-22": "recesso",
  "2026-12-23": "recesso", "2026-12-24": "recesso",
  "2026-12-25": "feriado",          // Natal
  "2026-12-28": "recesso", "2026-12-29": "recesso",
  "2026-12-30": "recesso", "2026-12-31": "recesso",
};

// Feriados e datas importantes listados
const FERIADOS_2026 = [
  { data: "03/04", nome: "Paixão de Cristo" },
  { data: "21/04", nome: "Tiradentes" },
  { data: "23/04", nome: "São Jorge" },
  { data: "01/05", nome: "Dia do Trabalhador" },
  { data: "04/06", nome: "Corpus Christi" },
  { data: "06/08", nome: "Santíssimo Salvador" },
  { data: "07/09", nome: "Independência do Brasil" },
  { data: "12/10", nome: "N. Sra. Aparecida" },
  { data: "02/11", nome: "Finados" },
  { data: "15/11", nome: "Proclamação da República" },
  { data: "20/11", nome: "Dia Nacional da Consciência Negra" },
  { data: "25/12", nome: "Natal" },
];

const BIMESTRES = [
  { label: "1º Bimestre", periodo: "04/02 – 30/04/2026", dias: 54, cor: "bg-sky-500/15 border-sky-500/30 text-sky-300" },
  { label: "2º Bimestre", periodo: "04/05 – 10/07/2026", dias: 50, cor: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
  { label: "3º Bimestre", periodo: "27/07 – 30/09/2026", dias: 48, cor: "bg-violet-500/15 border-violet-500/30 text-violet-300" },
  { label: "4º Bimestre", periodo: "01/10 – 18/12/2026", dias: 55, cor: "bg-amber-500/15 border-amber-500/30 text-amber-300" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }

function getTipo(year: number, month: number, day: number): TipoDia | "s" | "d" | "ferias" {
  if (month === 1) return "ferias"; // Janeiro todo é férias
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  const key = `${year}-${pad(month)}-${pad(day)}`;
  if (ESPECIAL[key]) return ESPECIAL[key];
  if (dow === 6) return "s";
  if (dow === 0) return "d";
  return "letivo";
}

const TIPO_STYLE: Record<string, { bg: string; text: string; label?: string }> = {
  letivo:  { bg: "",                       text: "text-white/80" },
  ferias:  { bg: "bg-slate-600/40",        text: "text-slate-400",  label: "FER" },
  feriado: { bg: "bg-red-500/25",          text: "text-red-300",    label: "F" },
  recesso: { bg: "bg-amber-500/20",        text: "text-amber-300",  label: "R" },
  sl:      { bg: "bg-green-500/20",        text: "text-green-300",  label: "SL" },
  cc:      { bg: "bg-purple-500/20",       text: "text-purple-300", label: "CC" },
  rp:      { bg: "bg-blue-500/20",         text: "text-blue-300",   label: "RP" },
  inicio:  { bg: "bg-cyan-500/25",         text: "text-cyan-300",   label: "→" },
  termino: { bg: "bg-cyan-500/25",         text: "text-cyan-300",   label: "←" },
  s:       { bg: "",                       text: "text-white/20" },
  d:       { bg: "",                       text: "text-white/20" },
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA_ABREV = ["D","S","T","Q","Q","S","S"];

// ─── Componente de mês ────────────────────────────────────────────────────────
function MesCalendario({ year, month }: { year: number; month: number }) {
  const diasNoMes = new Date(year, month, 0).getDate();
  const primeiroDia = new Date(year, month - 1, 1).getDay(); // 0=Dom

  const dias: ({ day: number; tipo: ReturnType<typeof getTipo> } | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) dias.push(null);
  for (let d = 1; d <= diasNoMes; d++) dias.push({ day: d, tipo: getTipo(year, month, d) });
  while (dias.length % 7 !== 0) dias.push(null);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/8 bg-white/5">
        <p className="text-sm font-bold text-white">{MESES[month - 1]}</p>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA_ABREV.map((d, i) => (
            <div key={i} className={`text-center text-[9px] font-bold py-0.5 ${
              i === 0 || i === 6 ? "text-white/25" : "text-white/40"
            }`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {dias.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const st = TIPO_STYLE[cell.tipo] ?? TIPO_STYLE.letivo;
            return (
              <div
                key={i}
                title={st.label ? `${cell.day}/${MESES[month-1]}: ${cell.tipo}` : undefined}
                className={`relative flex flex-col items-center justify-center rounded-md aspect-square text-[10px] font-semibold
                  ${st.bg} ${st.text} leading-none`}
              >
                {cell.day}
                {st.label && (
                  <span className="text-[6px] font-bold leading-none mt-0.5 opacity-80">{st.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Legenda ─────────────────────────────────────────────────────────────────
const LEGENDA = [
  { tipo: "letivo",  label: "Dia letivo",           bg: "bg-white/10",       text: "text-white/80" },
  { tipo: "feriado", label: "Feriado",               bg: "bg-red-500/25",     text: "text-red-300" },
  { tipo: "recesso", label: "Recesso",               bg: "bg-amber-500/20",   text: "text-amber-300" },
  { tipo: "ferias",  label: "Férias",                bg: "bg-slate-600/40",   text: "text-slate-400" },
  { tipo: "sl",      label: "Sábado Letivo",         bg: "bg-green-500/20",   text: "text-green-300" },
  { tipo: "cc",      label: "Conselho de Classe",    bg: "bg-purple-500/20",  text: "text-purple-300" },
  { tipo: "rp",      label: "Reunião Pedagógica",    bg: "bg-blue-500/20",    text: "text-blue-300" },
  { tipo: "inicio",  label: "Início/Término Sem.",   bg: "bg-cyan-500/25",    text: "text-cyan-300" },
];

// ─── Página ───────────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const MESES_ORDEM = [1,2,3,4,5,6,7,8,9,10,11,12];

  return (
    <AppLayout>
      <div className="space-y-8 pb-10">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center shrink-0">
            <CalendarDays className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
              Calendário Letivo 2026
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              E. M. José Giró Faísca — Campos dos Goytacazes · 207 dias letivos previstos
            </p>
          </div>
        </div>

        {/* Bimestres */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BIMESTRES.map(b => (
            <div key={b.label} className={`rounded-2xl border p-4 ${b.cor}`}>
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{b.label}</p>
              <p className="text-sm font-semibold leading-snug">{b.periodo}</p>
              <p className="text-2xl font-extrabold mt-2">{b.dias}<span className="text-sm font-normal opacity-60 ml-1">dias</span></p>
            </div>
          ))}
        </div>

        {/* Grade de meses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MESES_ORDEM.map(m => (
            <MesCalendario key={m} year={2026} month={m} />
          ))}
        </div>

        {/* Legenda + Feriados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Legenda */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Legenda</p>
            <div className="grid grid-cols-2 gap-2">
              {LEGENDA.map(l => (
                <div key={l.tipo} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center ${l.bg}`}>
                    <span className={`text-[9px] font-bold ${l.text}`}>
                      {l.tipo === "letivo" ? "D" : l.tipo === "sl" ? "SL" : l.tipo === "cc" ? "CC" :
                       l.tipo === "rp" ? "RP" : l.tipo === "inicio" ? "→" :
                       l.tipo === "feriado" ? "F" : l.tipo === "recesso" ? "R" :
                       l.tipo === "ferias" ? "FER" : ""}
                    </span>
                  </div>
                  <span className="text-xs text-white/60">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feriados */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Feriados 2026</p>
            <div className="space-y-2">
              {FERIADOS_2026.map(f => (
                <div key={f.data} className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-red-400 w-10 shrink-0">{f.data}</span>
                  <span className="text-xs text-white/70">{f.nome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé informativo */}
        <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4 text-xs text-white/40 space-y-1">
          <p>Calendário aprovado pela Secretaria Municipal de Educação, Ciência e Tecnologia — Prefeitura de Campos dos Goytacazes.</p>
          <p>Total de dias letivos previstos: <strong className="text-white/60">207</strong> · Início: <strong className="text-white/60">04/02/2026</strong> · Término: <strong className="text-white/60">18/12/2026</strong></p>
        </div>
      </div>
    </AppLayout>
  );
}

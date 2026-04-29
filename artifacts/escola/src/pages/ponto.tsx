// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  CalendarDays, ChevronDown, Printer, Plus, X, Users, UserCircle,
  ClipboardList, Download, Check, AlertCircle, FileText, FileSpreadsheet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ANOS = [2024, 2025, 2026, 2027];

/* ─── Feriados nacionais Brasil 2024-2027 ──────────────────────── */
/* formato: "AAAA-MM-DD" → label */
const FERIADOS_NACIONAIS: Record<string, string> = {
  /* 2024 */
  "2024-01-01": "Confraternização Universal",
  "2024-02-12": "Carnaval",
  "2024-02-13": "Carnaval",
  "2024-03-29": "Paixão de Cristo",
  "2024-04-21": "Tiradentes",
  "2024-05-01": "Dia do Trabalho",
  "2024-05-30": "Corpus Christi",
  "2024-09-07": "Independência do Brasil",
  "2024-10-12": "N.S. Aparecida",
  "2024-11-02": "Finados",
  "2024-11-15": "Proclamação da República",
  "2024-11-20": "Consciência Negra",
  "2024-12-25": "Natal",
  /* 2025 */
  "2025-01-01": "Confraternização Universal",
  "2025-03-03": "Carnaval",
  "2025-03-04": "Carnaval",
  "2025-04-18": "Paixão de Cristo",
  "2025-04-21": "Tiradentes",
  "2025-05-01": "Dia do Trabalho",
  "2025-06-19": "Corpus Christi",
  "2025-09-07": "Independência do Brasil",
  "2025-10-12": "N.S. Aparecida",
  "2025-11-02": "Finados",
  "2025-11-15": "Proclamação da República",
  "2025-11-20": "Consciência Negra",
  "2025-12-25": "Natal",
  /* 2026 */
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-04-03": "Paixão de Cristo",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-09-07": "Independência do Brasil",
  "2026-10-12": "N.S. Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-25": "Natal",
  /* 2027 */
  "2027-01-01": "Confraternização Universal",
  "2027-02-08": "Carnaval",
  "2027-02-09": "Carnaval",
  "2027-03-26": "Paixão de Cristo",
  "2027-04-21": "Tiradentes",
  "2027-05-01": "Dia do Trabalho",
  "2027-05-27": "Corpus Christi",
  "2027-09-07": "Independência do Brasil",
  "2027-10-12": "N.S. Aparecida",
  "2027-11-02": "Finados",
  "2027-11-15": "Proclamação da República",
  "2027-11-20": "Consciência Negra",
  "2027-12-25": "Natal",
};

/* ─── Tipos ─────────────────────────────────────────────────────── */
interface DiaEspecial {
  id: string;       /* uuid interno */
  dia: number;
  label: string;    /* ex: "FERIADO" ou "RECESSO" */
  nome: string;     /* ex: "Ano Novo" ou "Recesso Escolar" */
}

interface Pessoa {
  id: number;
  nome: string;
  matricula?: string;
  cargo?: string;
}

/* ─── Gerador de HTML ────────────────────────────────────────────── */
function gerarHtmlPonto(
  pessoas: Pessoa[],
  mes: number,          /* 0-indexed */
  ano: number,
  diasEspeciais: DiaEspecial[],
  tipo: string,
): string {
  const nomeMes   = MESES[mes].toUpperCase();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  /* mapa dia → especial */
  const mapaEspecial: Record<number, DiaEspecial> = {};
  diasEspeciais.forEach(d => { mapaEspecial[d.dia] = d; });

  /* função: gera a tabela de dias para 1 pessoa */
  function tabelaPessoa(p: Pessoa): string {
    const linhas = Array.from({ length: diasNoMes }, (_, i) => {
      const dia  = i + 1;
      const date = new Date(ano, mes, dia);
      const dow  = date.getDay(); /* 0=Dom, 6=Sáb */

      /* ASSINATURA = célula única para assinar; HORÁRIO tem sub-colunas Entrada/Saída */
      let assinaturaCell = `<td class="cel-ass"></td>`;
      let horarioEntrada = `<td class="cel-entrada"></td>`;
      let horarioSaida   = `<td class="cel-saida"></td>`;
      let rubricaCell    = `<td class="cel-rubrica"></td>`;
      let rowClass       = "";

      if (dow === 6) {
        assinaturaCell = `<td class="cel-especial">SÁBADO</td>`;
        rubricaCell    = `<td class="cel-especial">SÁBADO</td>`;
        horarioEntrada = `<td class="cel-fim cel-hifen">-</td>`;
        horarioSaida   = `<td class="cel-fim cel-hifen">-</td>`;
        rowClass       = "row-fim";
      } else if (dow === 0) {
        assinaturaCell = `<td class="cel-especial">DOMINGO</td>`;
        rubricaCell    = `<td class="cel-especial">DOMINGO</td>`;
        horarioEntrada = `<td class="cel-fim cel-hifen">-</td>`;
        horarioSaida   = `<td class="cel-fim cel-hifen">-</td>`;
        rowClass       = "row-fim";
      } else if (mapaEspecial[dia]) {
        const esp = mapaEspecial[dia];
        assinaturaCell = `<td class="cel-especial cel-${esp.label.toLowerCase()}">${esp.label}</td>`;
        rubricaCell    = `<td class="cel-especial cel-${esp.label.toLowerCase()}">${esp.label}</td>`;
        horarioEntrada = `<td class="cel-${esp.label.toLowerCase()}-bg cel-hifen">-</td>`;
        horarioSaida   = `<td class="cel-${esp.label.toLowerCase()}-bg cel-hifen">-</td>`;
        rowClass       = `row-${esp.label.toLowerCase()}`;
      }

      const obsCell = rowClass
        ? `<td class="cel-obs cel-hifen${rowClass === "row-fim" ? " cel-fim" : rowClass === "row-feriado" ? " cel-feriado-bg" : rowClass === "row-recesso" ? " cel-recesso-bg" : ""}">-</td>`
        : `<td class="cel-obs"></td>`;

      return `<tr class="${rowClass}">
        <td class="cel-data">${dia}</td>
        ${assinaturaCell}
        ${horarioEntrada}
        ${horarioSaida}
        ${obsCell}
        ${rubricaCell}
      </tr>`;
    }).join("\n");

    return `
    <div class="folha-ponto">
      <div class="cabecalho">
        <div class="cab-textos">
          <p class="cab-linha1">Prefeitura do Município de Campos dos Goytacazes</p>
          <p class="cab-linha2">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
          <p class="cab-nome-escola">E. M. José Giró Faísca</p>
        </div>
        <img src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" class="cab-logo" alt="Logo" />
      </div>

      <table class="tab-info">
        <tr>
          <td class="info-label">NOME DO FUNCIONÁRIO:</td>
          <td class="info-valor">${p.nome}</td>
          <td class="info-label mat-label">Nº DA MATRÍCULA</td>
        </tr>
        <tr>
          <td class="info-label">FUNÇÃO QUE EXERCE:</td>
          <td class="info-valor">${p.cargo || ""}</td>
          <td class="info-mat">${p.matricula || ""}</td>
        </tr>
      </table>

      <p class="titulo-ponto">ANOTAÇÕES DAS HORAS DE TRABALHO</p>
      <p class="subtitulo-mes">MÊS: ${nomeMes}/${ano}</p>

      <table class="tab-ponto">
        <colgroup>
          <col style="width:28px">    <!-- DATA -->
          <col style="width:210px">   <!-- ASSINATURA -->
          <col style="width:54px">    <!-- Entrada -->
          <col style="width:54px">    <!-- Saída -->
          <col style="width:100px">   <!-- OBSERVAÇÕES -->
          <col style="width:65px">    <!-- RUBRICA -->
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2" class="th-data">DATA</th>
            <th rowspan="2" class="th-ass">ASSINATURA</th>
            <th colspan="2" class="th-horario">HORÁRIO</th>
            <th rowspan="2" class="th-obs">OBSERVAÇÕES</th>
            <th rowspan="2" class="th-rubrica">RUBRICA</th>
          </tr>
          <tr>
            <th class="th-sub">Entrada</th>
            <th class="th-sub">Saída</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>

    </div>`;
  }

  const paginas = pessoas.map(p => tabelaPessoa(p)).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ponto — ${tipo} — ${MESES[mes]}/${ano}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; background: white; color: #000; }

    .no-print {
      padding: 10px 14px; margin-bottom: 14px;
      background: #f0f4f8; border-radius: 6px;
      display: flex; align-items: center; gap: 10px;
    }
    .no-print button {
      padding: 9px 20px; cursor: pointer;
      background: #2563eb; color: #fff;
      border: none; border-radius: 5px;
      font-size: 13px; font-weight: bold;
    }
    @media print { .no-print { display: none !important; } }

    /* ── folha individual ── */
    .folha-ponto { page-break-after: always; padding-bottom: 8px; }
    .folha-ponto:last-child { page-break-after: auto; }

    /* ── cabeçalho ── */
    .cabecalho {
      display: flex; justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #000;
      padding-bottom: 10px; margin-bottom: 8px;
    }
    .cab-textos { flex: 1; }
    .cab-linha1 { font-size: 9pt; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; }
    .cab-linha2 { font-size: 8.5pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .cab-nome-escola { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .cab-logo { width: 68px; height: 68px; object-fit: contain; }

    /* ── info do funcionário ── */
    .tab-info {
      width: 100%; border-collapse: collapse;
      margin-bottom: 10px;
      border: 1.5px solid #000;
      outline: 1.5px solid #000;
    }
    .tab-info tr td { padding: 4px 7px; border: 1px solid #999; font-size: 9pt; }
    .info-label { font-weight: bold; white-space: nowrap; width: 180px; background: #f5f5f5; }
    .info-valor { font-size: 9.5pt; }
    .mat-label { font-weight: bold; text-align: center; background: #f5f5f5; border-left: 2px solid #000; border-right: 1.5px solid #000; width: 150px; }
    .info-mat { font-size: 12pt; font-weight: bold; text-align: center; border-left: 2px solid #000; border-right: 1.5px solid #000; }

    /* ── título ── */
    .titulo-ponto {
      font-size: 11pt; font-weight: bold; text-transform: uppercase;
      text-align: center; margin: 8px 0 2px;
      letter-spacing: 1px;
    }
    .subtitulo-mes {
      font-size: 10pt; font-weight: bold; text-align: center;
      margin-bottom: 8px; letter-spacing: 0.5px;
    }

    /* ── tabela de ponto ── */
    .tab-ponto { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #444; }
    .tab-ponto th, .tab-ponto td {
      border: 1px solid #555;
      text-align: center;
      font-size: 9pt;
      overflow: hidden;
    }
    .cel-hifen { color: #888; font-size: 9pt; }
    /* larguras fixas das colunas:
       DATA(28) + ASSINATURA(220) + Entrada(52) + Saída(52) + OBS(100) + RUBRICA(65) = ~517px */
    .th-data    { width: 28px;  padding: 5px 3px; background: #e8e8e8; vertical-align: middle; }
    .th-ass     { width: 220px; padding: 5px 6px; background: #e8e8e8; vertical-align: middle; }
    .th-horario { padding: 5px 3px; background: #e8e8e8; vertical-align: middle; }
    .th-obs     { width: 100px; padding: 5px 3px; background: #e8e8e8; vertical-align: middle; }
    .th-rubrica { width: 65px;  padding: 5px 3px; background: #e8e8e8; vertical-align: middle; }
    .th-sub     { width: 52px;  font-size: 7.5pt; padding: 3px 2px; background: #f0f0f0; }

    .cel-data   { font-weight: bold; font-size: 9.5pt; padding: 3px 4px; height: 19px; }
    .cel-ass    { padding: 3px 4px; height: 19px; }
    .cel-entrada, .cel-saida { padding: 3px 2px; height: 19px; }
    .cel-obs    { padding: 3px 4px; height: 19px; }
    .cel-rubrica { padding: 3px 2px; height: 19px; }

    /* ── dias especiais ── */
    .cel-especial {
      font-weight: bold; font-size: 8.5pt;
      letter-spacing: 0.5px;
      text-align: center;
      padding: 3px 2px;
    }
    .cel-fim { background: #f0f0f0; }
    .row-fim td { background: #f0f0f0; color: #555; }
    .cel-feriado { background: #fff3cd !important; color: #856404 !important; }
    .cel-recesso { background: #d1ecf1 !important; color: #0c5460 !important; }
    .cel-feriado-bg { background: #fffbea !important; }
    .cel-recesso-bg { background: #e8f6f8 !important; }
    .row-feriado td { background: #fffbea; }
    .row-recesso td { background: #e8f6f8; }

  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ IMPRIMIR / SALVAR PDF</button>
    <span style="font-size:12px;color:#555">
      <strong>${tipo}</strong> — ${MESES[mes]}/${ano} — ${pessoas.length} página${pessoas.length !== 1 ? "s" : ""}
    </span>
  </div>
  ${paginas}
</body>
</html>`;
}

/* ─── Modal: selecionar pessoas ──────────────────────────────────── */
function ModalSelecionar({
  titulo, pessoas, onImprimir, onPdf, onExcel, onClose,
}: {
  titulo: string;
  pessoas: Pessoa[];
  onImprimir: (selecionados: Pessoa[]) => void;
  onPdf: (selecionados: Pessoa[]) => void;
  onExcel: (selecionados: Pessoa[]) => void;
  onClose: () => void;
}) {
  const [sels, setSels] = useState<Set<number>>(new Set(pessoas.map(p => p.id)));
  const toggle = (id: number) => setSels(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const toggleTodos = () => setSels(sels.size === pessoas.length ? new Set() : new Set(pessoas.map(p => p.id)));
  const selecionados = pessoas.filter(p => sels.has(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }} transition={{ duration: 0.2 }}
        className="relative w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-[#0f172a]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <h3 className="font-bold text-white text-base">{titulo}</h3>
            <p className="text-xs text-white/40 mt-0.5">{sels.size} de {pessoas.length} selecionados</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
          <button onClick={toggleTodos} className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${pessoas.length > 0 && sels.size === pessoas.length ? "bg-blue-500 border-blue-500" : "border-white/30"}`}>
              {pessoas.length > 0 && sels.size === pessoas.length && <Check className="h-2.5 w-2.5 text-white" />}
            </div>
            {pessoas.length > 0 && sels.size === pessoas.length ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {pessoas.map(p => (
            <button key={p.id} onClick={() => toggle(p.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left">
              <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${sels.has(p.id) ? "bg-blue-500 border-blue-500" : "border-white/30"}`}>
                {sels.has(p.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.nome}</p>
                <p className="text-[10px] text-white/40">{p.cargo || "—"} {p.matricula ? `· Mat. ${p.matricula}` : ""}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-white/5 shrink-0 flex flex-col gap-2">
          <button
            disabled={sels.size === 0}
            onClick={() => { onImprimir(selecionados); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            <Printer className="h-4 w-4" />
            Imprimir Ponto ({sels.size})
          </button>
          <div className="flex gap-2">
            <button
              disabled={sels.size === 0}
              onClick={() => { onPdf(selecionados); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              disabled={sels.size === 0}
              onClick={() => { onExcel(selecionados); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Seção de dias especiais (feriados / recessos) ─────────────── */
function SecaoDiasEspeciais({
  titulo, cor, label, diasNoMes, ano, mes,
  itens, onAdd, onRemove, onUpdate,
}: {
  titulo: string;
  cor: "amber" | "cyan";
  label: string;
  diasNoMes: number;
  ano: number;
  mes: number;
  itens: DiaEspecial[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, campo: "dia" | "nome", valor: string | number) => void;
}) {
  const isAmber  = cor === "amber";
  const borderCl = isAmber ? "border-amber-500/25" : "border-cyan-500/25";
  const bgCl     = isAmber ? "bg-amber-500/5"      : "bg-cyan-500/5";
  const titleCl  = isAmber ? "text-amber-400"      : "text-cyan-400";
  const badgeBg  = isAmber ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/20 text-cyan-300";
  const btnCl    = isAmber
    ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
    : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25";
  const itemBg   = isAmber ? "bg-amber-500/8 border-amber-500/15" : "bg-cyan-500/8 border-cyan-500/15";

  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className={`rounded-xl border ${borderCl} ${bgCl} overflow-hidden`}>
      {/* Cabeçalho da seção */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <span className={`text-[0.7rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${badgeBg}`}>
            {label}
          </span>
          <div>
            <p className={`text-sm font-bold ${titleCl}`}>{titulo}</p>
            <p className="text-[0.68rem] text-white/35 leading-tight">
              {itens.length === 0
                ? "Nenhum dia configurado"
                : `${itens.length} dia${itens.length !== 1 ? "s" : ""} no mês`}
            </p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors ${btnCl}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </button>
      </div>

      {/* Lista de itens */}
      {itens.length > 0 && (
        <div className="p-3 space-y-2">
          {itens.map(item => {
            const date = new Date(ano, mes, item.dia);
            const dow  = DIAS_SEMANA[date.getDay()];
            return (
              <div key={item.id} className={`flex items-center gap-3 rounded-lg border ${itemBg} px-3 py-2`}>
                {/* Badge do dia — visível e grande */}
                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-12 rounded-lg ${badgeBg} select-none`}>
                  <span className="text-xl font-black leading-none">{String(item.dia).padStart(2, "0")}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-75">{dow}</span>
                </div>

                {/* Seletor de dia compacto */}
                <select
                  value={item.dia}
                  onChange={e => onUpdate(item.id, "dia", Number(e.target.value))}
                  className="w-[110px] px-2 py-1.5 rounded-lg text-xs border border-white/10 focus:border-blue-500 focus:outline-none cursor-pointer"
                  style={{ background: "#1e293b", color: "#fff" }}
                >
                  {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(d => {
                    const dt  = new Date(ano, mes, d);
                    const dw  = DIAS_SEMANA[dt.getDay()];
                    return <option key={d} value={d} style={{ background: "#1e293b", color: "#fff" }}>{String(d).padStart(2, "0")} — {dw}</option>;
                  })}
                </select>

                {/* Nome do evento */}
                <input
                  type="text"
                  value={item.nome}
                  onChange={e => onUpdate(item.id, "nome", e.target.value)}
                  placeholder="Nome do evento"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:border-blue-500 focus:outline-none placeholder:text-white/25"
                />

                {/* Botão remover */}
                <button
                  onClick={() => onRemove(item.id)}
                  className="flex-shrink-0 p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/12 transition-colors"
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {itens.length === 0 && (
        <p className="text-[0.72rem] text-white/25 italic text-center py-4">
          Clique em "Adicionar" para incluir {label.toLowerCase()} no mês
        </p>
      )}
    </div>
  );
}

/* ─── Página principal ───────────────────────────────────────────── */
export default function PontoPage() {
  const hoje = new Date();

  /* dados */
  const { data: funcionarios = [] } = useQuery<any[]>({
    queryKey: ["/api/funcionarios"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/funcionarios`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar funcionários");
      return r.json();
    },
  });
  const { data: professores = [] } = useQuery<any[]>({
    queryKey: ["/api/professores"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/professores`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar professores");
      return r.json();
    },
  });

  /* mês/ano */
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());

  /* dias especiais */
  const [feriados, setFeriados] = useState<DiaEspecial[]>([]);
  const [recessos, setRecessos] = useState<DiaEspecial[]>([]);

  const diasNoMes = new Date(anoSel, mesSel + 1, 0).getDate();

  /* Quando mês/ano muda → pré-carrega feriados nacionais do mês */
  const feriadosNacionaisDoMes = useMemo(() => {
    const result: { dia: number; nome: string }[] = [];
    for (const [chave, nome] of Object.entries(FERIADOS_NACIONAIS)) {
      const [a, m, d] = chave.split("-").map(Number);
      if (a === anoSel && m - 1 === mesSel) {
        result.push({ dia: d, nome });
      }
    }
    return result.sort((a, b) => a.dia - b.dia);
  }, [mesSel, anoSel]);

  /* quando mês/ano muda, aplica feriados nacionais automaticamente */
  const primeiroRender = useRef(true);
  useEffect(() => {
    const inicial = feriadosNacionaisDoMes.map((f, i) => ({
      id: `fn-${i}-${f.dia}`, dia: f.dia, label: "FERIADO", nome: f.nome,
    }));
    setFeriados(inicial);
    if (!primeiroRender.current) setRecessos([]);
    primeiroRender.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSel, anoSel]);

  function addFeriado() {
    setFeriados(prev => [...prev, { id: `f-${Date.now()}`, dia: 1, label: "FERIADO", nome: "" }]);
  }
  function removeFeriado(id: string) {
    setFeriados(prev => prev.filter(f => f.id !== id));
  }
  function updateFeriado(id: string, campo: "dia" | "nome", valor: string | number) {
    setFeriados(prev => prev.map(f => f.id === id ? { ...f, [campo]: valor } : f));
  }

  function addRecesso() {
    setRecessos(prev => [...prev, { id: `r-${Date.now()}`, dia: 1, label: "RECESSO", nome: "Recesso Escolar" }]);
  }
  function removeRecesso(id: string) {
    setRecessos(prev => prev.filter(r => r.id !== id));
  }
  function updateRecesso(id: string, campo: "dia" | "nome", valor: string | number) {
    setRecessos(prev => prev.map(r => r.id === id ? { ...r, [campo]: valor } : r));
  }

  /* lista de dias especiais combinados */
  const diasEspeciais: DiaEspecial[] = [...feriados, ...recessos];

  /* pessoas formatadas */
  const listaProfessores: Pessoa[] = (professores as any[]).map(p => ({
    id: p.id,
    nome: p.nome,
    matricula: p.matricula || "",
    cargo: "Professor(a)",
  }));

  const listaFuncionarios: Pessoa[] = (funcionarios as any[]).map(f => ({
    id: f.id,
    nome: f.nomeCompleto,
    matricula: f.matricula || "",
    cargo: f.funcao || "",
  }));

  const listaTodos = [...listaProfessores, ...listaFuncionarios];

  /* modal */
  const [modal, setModal] = useState<{ titulo: string; pessoas: Pessoa[]; tipo: string } | null>(null);

  function imprimir(pessoas: Pessoa[], tipo: string) {
    const html = gerarHtmlPonto(pessoas, mesSel, anoSel, diasEspeciais, tipo);
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  const DIAS_SEMANA_PONTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  function gerarPdfPonto(pessoas: Pessoa[], tipo: string) {
    if (pessoas.length === 0) return;
    const nomeMes  = MESES[mesSel];
    const diasNoM  = new Date(anoSel, mesSel + 1, 0).getDate();
    const hoje     = new Date().toLocaleDateString("pt-BR");
    const doc      = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw       = doc.internal.pageSize.getWidth();
    const mg       = 12;

    const mapaEsp: Record<number, DiaEspecial> = {};
    diasEspeciais.forEach(d => { mapaEsp[d.dia] = d; });

    pessoas.forEach((p, pi) => {
      if (pi > 0) doc.addPage();

      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES", mg, 10);
      doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA", mg, 14);
      doc.text("E. M. JOSÉ GIRÓ FAÍSCA", mg, 18);
      doc.setFont("helvetica", "normal");
      doc.text(`FUNCIONÁRIO: ${p.nome}     FUNÇÃO: ${p.cargo || "—"}${p.matricula ? "     MATRÍCULA: " + p.matricula : ""}     MÊS: ${nomeMes.toUpperCase()}/${anoSel}`, mg, 22);
      doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(mg, 24, pw - mg, 24);

      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`ANOTAÇÕES DAS HORAS DE TRABALHO — ${nomeMes.toUpperCase()}/${anoSel}`, pw / 2, 29, { align: "center" });

      const body: (string | object)[][] = Array.from({ length: diasNoM }, (_, i) => {
        const dia  = i + 1;
        const dow  = new Date(anoSel, mesSel, dia).getDay();
        const esp  = mapaEsp[dia];
        let obs    = "";
        if (dow === 6)      obs = "SÁBADO";
        else if (dow === 0) obs = "DOMINGO";
        else if (esp)       obs = esp.label;
        return [String(dia).padStart(2, "0"), DIAS_SEMANA_PONTO[dow], "", "", "", obs, ""];
      });

      autoTable(doc, {
        head: [["Data", "Dia", "Assinatura", "Entrada", "Saída", "Observações", "Rubrica"]],
        body,
        startY: 33,
        margin: { left: mg, right: mg },
        styles: { fontSize: 7, cellPadding: 1.8, valign: "middle" },
        headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 14, halign: "center" },
          2: { cellWidth: 55 },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 32 },
          6: { cellWidth: 18 },
        },
        willDrawCell: (data) => {
          if (data.section === "body") {
            const obs = String((data.row.raw as any)[5] ?? "");
            if (obs === "SÁBADO" || obs === "DOMINGO") {
              doc.setFillColor(220, 220, 220);
            } else if (obs === "FERIADO") {
              doc.setFillColor(255, 243, 205);
            } else if (obs === "RECESSO") {
              doc.setFillColor(204, 235, 255);
            }
          }
        },
        tableLineColor: 0, tableLineWidth: 0.1,
      });
    });

    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`Ponto_${tipo.replace(/\s+/g, "_")}_${nomeMes}_${anoSel}_${dataStr}.pdf`);
  }

  function gerarExcelPonto(pessoas: Pessoa[], tipo: string) {
    if (pessoas.length === 0) return;
    const nomeMes = MESES[mesSel];
    const diasNoM = new Date(anoSel, mesSel + 1, 0).getDate();
    const hoje    = new Date().toLocaleDateString("pt-BR");
    const wb      = XLSX.utils.book_new();

    const mapaEsp: Record<number, DiaEspecial> = {};
    diasEspeciais.forEach(d => { mapaEsp[d.dia] = d; });

    pessoas.forEach(p => {
      const linhas: (string | number)[][] = [
        ["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"],
        ["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"],
        ["E. M. JOSÉ GIRÓ FAÍSCA"],
        [`FUNCIONÁRIO: ${p.nome}     FUNÇÃO: ${p.cargo || "—"}${p.matricula ? "     MATRÍCULA: " + p.matricula : ""}     MÊS: ${nomeMes.toUpperCase()}/${anoSel}     EMISSÃO: ${hoje}`],
        [],
        ["ANOTAÇÕES DAS HORAS DE TRABALHO"],
        [`MÊS: ${nomeMes.toUpperCase()}/${anoSel}`],
        [],
        ["Data", "Dia", "Assinatura", "Entrada", "Saída", "Observações", "Rubrica"],
      ];

      Array.from({ length: diasNoM }, (_, i) => {
        const dia = i + 1;
        const dow = new Date(anoSel, mesSel, dia).getDay();
        const esp = mapaEsp[dia];
        let obs   = "";
        if (dow === 6)      obs = "SÁBADO";
        else if (dow === 0) obs = "DOMINGO";
        else if (esp)       obs = esp.label;
        linhas.push([String(dia).padStart(2, "0"), DIAS_SEMANA_PONTO[dow], "", "", "", obs, ""]);
      });

      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["!cols"] = [{ wch: 8 }, { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 }];
      const nomePlan = p.nome.slice(0, 31).replace(/[\\/?*[\]:]/g, "_");
      XLSX.utils.book_append_sheet(wb, ws, nomePlan);
    });

    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Ponto_${tipo.replace(/\s+/g, "_")}_${nomeMes}_${anoSel}_${dataStr}.xlsx`);
  }

  /* botões */
  const botoes = [
    {
      id: "todos", label: "Imprimir Todos", desc: "Professores + Funcionários",
      icon: Download, cor: "blue",
      acao: () => imprimir(listaTodos, "Professores e Funcionários"),
    },
    {
      id: "professores", label: "Somente Professores",
      desc: `${listaProfessores.length} professor${listaProfessores.length !== 1 ? "es" : ""}`,
      icon: UserCircle, cor: "violet",
      acao: () => imprimir(listaProfessores, "Professores"),
    },
    {
      id: "funcionarios", label: "Somente Funcionários",
      desc: `${listaFuncionarios.length} funcionário${listaFuncionarios.length !== 1 ? "s" : ""}`,
      icon: Users, cor: "orange",
      acao: () => imprimir(listaFuncionarios, "Funcionários Administrativos"),
    },
    {
      id: "especifico", label: "Impressão Específica",
      desc: "Escolher quem imprimir",
      icon: ClipboardList, cor: "emerald",
      acao: () => setModal({ titulo: "Selecionar para Impressão", pessoas: listaTodos, tipo: "Selecionados" }),
    },
  ] as const;

  const corMap = {
    blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-300",    icon: "bg-blue-500/20 text-blue-400" },
    violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-300",  icon: "bg-violet-500/20 text-violet-400" },
    orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-300",  icon: "bg-orange-500/20 text-orange-400" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300", icon: "bg-emerald-500/20 text-emerald-400" },
  };

  const totalEspeciais = feriados.length + recessos.length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8 pb-10">
        {/* cabeçalho */}
        <div>
          <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
            Ponto dos Funcionários
          </h1>
          <p className="text-white/40 text-sm mt-1">Gere a folha de ponto individual mensal para professores e funcionários.</p>
        </div>

        {/* seletor mês/ano */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-white/10 space-y-4">
          <p className="text-[0.72rem] font-black uppercase tracking-widest text-slate-400">Período de referência</p>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Mês */}
            <div className="flex items-center gap-2 bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2.5">
              <CalendarDays className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-white/40 font-bold uppercase tracking-widest mr-1">Mês</span>
              <div className="relative">
                <select
                  className="appearance-none bg-transparent text-white font-bold text-sm pr-6 cursor-pointer focus:outline-none"
                  value={mesSel}
                  onChange={e => setMesSel(Number(e.target.value))}
                >
                  {MESES.map((m, i) => <option key={m} value={i} className="bg-[#0f172a]">{m}</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* Ano */}
            <div className="flex items-center gap-2 bg-[#0f172a] border border-white/10 rounded-xl px-4 py-2.5">
              <span className="text-xs text-white/40 font-bold uppercase tracking-widest mr-1">Ano</span>
              <div className="relative">
                <select
                  className="appearance-none bg-transparent text-white font-bold text-sm pr-6 cursor-pointer focus:outline-none"
                  value={anoSel}
                  onChange={e => setAnoSel(Number(e.target.value))}
                >
                  {ANOS.map(a => <option key={a} value={a} className="bg-[#0f172a]">{a}</option>)}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>

            <div className="px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm font-bold text-blue-300">
              {MESES[mesSel]} de {anoSel} · {diasNoMes} dias
            </div>
          </div>

          {/* Aviso: sábados e domingos automáticos */}
          <div className="flex items-start gap-2 p-3 bg-white/3 rounded-lg border border-white/5">
            <AlertCircle className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
            <p className="text-[0.7rem] text-white/30">
              <span className="text-white/50 font-semibold">Sábados e domingos</span> são preenchidos automaticamente no ponto conforme o calendário do mês selecionado.
            </p>
          </div>
        </div>

        {/* dias especiais */}
        <div className="bg-[#1e293b] p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <p className="text-[0.72rem] font-black uppercase tracking-widest text-slate-400">Dias Especiais do Mês</p>
              <p className="text-[0.7rem] text-white/30 mt-0.5">
                Configure feriados e recessos — aparecem preenchidos automaticamente em cada folha
              </p>
            </div>
            {totalEspeciais > 0 && (
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-[0.7rem] font-black rounded-full">
                {totalEspeciais} dia{totalEspeciais !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <SecaoDiasEspeciais
            titulo="Feriados"
            cor="amber"
            label="FERIADO"
            diasNoMes={diasNoMes}
            ano={anoSel}
            mes={mesSel}
            itens={feriados}
            onAdd={addFeriado}
            onRemove={removeFeriado}
            onUpdate={updateFeriado}
          />

          <SecaoDiasEspeciais
            titulo="Recessos Escolares"
            cor="cyan"
            label="RECESSO"
            diasNoMes={diasNoMes}
            ano={anoSel}
            mes={mesSel}
            itens={recessos}
            onAdd={addRecesso}
            onRemove={removeRecesso}
            onUpdate={updateRecesso}
          />
        </div>

        {/* botões de impressão */}
        <div className="space-y-3">
          <p className="text-[0.72rem] font-black uppercase tracking-widest text-slate-400">Gerar Folha de Ponto</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {botoes.map(btn => {
              const c = corMap[btn.cor];
              const Icone = btn.icon;
              const pessoas = btn.id === "todos" ? listaTodos
                : btn.id === "professores" ? listaProfessores
                : btn.id === "funcionarios" ? listaFuncionarios
                : null; /* especifico => modal */
              return (
                <div key={btn.id} className={`rounded-2xl border ${c.bg} ${c.border} overflow-hidden`}>
                  <button
                    onClick={btn.acao}
                    className={`flex items-center gap-4 p-5 w-full hover:brightness-110 transition-all duration-200 text-left group`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.icon.split(" ")[0]}`}>
                      <Icone className={`h-6 w-6 ${c.icon.split(" ")[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-base ${c.text}`}>{btn.label}</p>
                      <p className="text-white/30 text-xs mt-0.5">{btn.desc}</p>
                    </div>
                    <Printer className={`h-5 w-5 ${c.text} opacity-40 group-hover:opacity-80 transition-opacity`} />
                  </button>
                  {pessoas && (
                    <div className="flex items-center gap-2 px-5 pb-4">
                      <button
                        onClick={() => gerarPdfPonto(pessoas, btn.label)}
                        disabled={pessoas.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        PDF
                      </button>
                      <button
                        onClick={() => gerarExcelPonto(pessoas, btn.label)}
                        disabled={pessoas.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 transition-colors"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Excel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* info */}
        <div className="p-4 bg-white/3 border border-white/5 rounded-xl text-xs text-white/30 space-y-1.5">
          <p className="font-bold text-white/50 mb-2">ℹ️ Sobre a Folha de Ponto</p>
          <p>• Cada funcionário/professor recebe <strong className="text-white/50">uma página individual</strong> no formato A4 retrato.</p>
          <p>• Sábados e domingos aparecem em cinza. Feriados em amarelo. Recessos em azul claro.</p>
          <p>• Para adicionar a matrícula dos funcionários, edite o cadastro de cada um na seção Funcionários.</p>
          <p>• Os feriados nacionais do mês são carregados automaticamente ao trocar o mês.</p>
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <ModalSelecionar
            titulo={modal.titulo}
            pessoas={modal.pessoas}
            onClose={() => setModal(null)}
            onImprimir={sels => imprimir(sels, modal.tipo)}
            onPdf={sels => gerarPdfPonto(sels, modal.tipo)}
            onExcel={sels => gerarExcelPonto(sels, modal.tipo)}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListarAlunos, useGetMe } from "@workspace/api-client-react";
import {
  FileText, Search, Loader2, ChevronRight, ChevronLeft,
  Baby, BookOpen, ClipboardList, Plus, X, Calendar,
  Pencil, Trash2, UserPlus, Check, Users, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ─── Constantes ──────────────────────────────────────────────────────────────
const SERIES_INFANTIL  = ["G1", "G2", "G3", "P1", "P2"] as const;
const ANOS_FUNDAMENTAL = ["1º","2º","3º","4º","5º","6º","7º","8º","9º"] as const;

const OBJETIVOS = [
  "comprovação escolar",
  "atestado",
  "bolsa família",
  "transferência",
  "encaminhamento",
  "declaração de conclusão",
] as const;

const RESULTADOS_FUND = [
  { valor: "em continuidade de estudo",                label: "Em Continuidade de Estudo" },
  { valor: "aprovado(a)",                              label: "Aprovado(a)" },
  { valor: "aprovado com progressão parcial",          label: "Aprovado com Progressão Parcial" },
  { valor: "reprovado",                                label: "Reprovado" },
  { valor: "reprovado por frequência",                 label: "Reprovado por frequência" },
  { valor: "reprovado por frequência – reclassificado",label: "Reprovado por frequência – Reclassificado" },
  { valor: "deixou de frequentar",                     label: "Deixou de frequentar" },
  { valor: "transferido",                              label: "Transferido" },
] as const;

// ─── Constantes Pré-Diário ────────────────────────────────────────────────────
const MESES_NOME = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const ANOS_DISP = [2024, 2025, 2026, 2027];

interface DiaEspecialPD {
  id: string;
  dia: number;
  nome: string;
  tipo: "feriado" | "recesso";
}

const FERIADOS_NACIONAIS_PD: Record<string, string> = {
  "2024-01-01": "Confraternização Universal",
  "2024-02-12": "Carnaval",  "2024-02-13": "Carnaval",
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
  "2025-01-01": "Confraternização Universal",
  "2025-03-03": "Carnaval",  "2025-03-04": "Carnaval",
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
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval",  "2026-02-17": "Carnaval",
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
  "2027-01-01": "Confraternização Universal",
  "2027-02-08": "Carnaval",  "2027-02-09": "Carnaval",
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dataPorExtenso() {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho",
                 "agosto","setembro","outubro","novembro","dezembro"];
  const d = new Date();
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function detectarSerieInfantil(turma: string): string {
  const t = (turma || "").toUpperCase();
  for (const s of SERIES_INFANTIL) if (t.includes(s)) return s;
  return "";
}

function extrairAnoFundamental(turma: string): string {
  const t = turma || "";
  let m = t.match(/([1-9])\s*[ºo°]/i); if (m) return `${m[1]}º`;
      m = t.match(/^([1-9])/);          if (m) return `${m[1]}º`;
      m = t.toUpperCase().match(/([1-9])\s*ANO/); if (m) return `${m[1]}º`;
  return "___";
}

function detectarNivel(turma: string): "infantil" | "fundamental" | "" {
  const t = (turma || "").toUpperCase();
  if (detectarSerieInfantil(t)) return "infantil";
  if (extrairAnoFundamental(t) !== "___") return "fundamental";
  return "";
}

// ─── CSS do documento impresso ───────────────────────────────────────────────
const CSS_DOC = `
  @page { size: A4; margin: 1.8cm 1.5cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; background: #fff; }
  .no-print { display: flex; gap: 10px; margin-bottom: 16px; padding: 10px; background: #f0f0f0; border-radius: 6px; }
  .no-print button { padding: 10px 22px; cursor: pointer; font-weight: bold; border-radius: 5px; border: none; font-size: 14px; background: #10b981; color: #fff; }
  @media print { .no-print { display: none !important; } }

  /* ── Cabeçalho ── */
  .cab { display: flex; align-items: center; justify-content: space-between; gap: 10px;
         border-bottom: 2.5px solid #000; padding-bottom: 8px; margin-bottom: 6px; }
  .cab-info { font-size: 11pt; font-weight: bold; text-transform: uppercase; }
  .cab-info p { margin: 1.5px 0; }
  .cab-info p.pref { font-size: 10.5pt; }
  .cab-info p.escola { font-size: 12pt; }
  .logo { width: 75px; height: 75px; object-fit: contain; }

  /* Bloco de dados institucionais (tamanho 11pt) */
  .dados-inst { font-size: 11pt; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 6px; }
  .dados-inst p { margin: 1px 0; }

  /* ── Título ── */
  .titulo { text-align: center; font-size: 18pt; font-weight: bold; text-transform: uppercase;
            letter-spacing: 1px; margin: 8px 0 8px; text-decoration: underline; }

  /* ── Corpo da declaração (10pt) ── */
  .corpo { line-height: 1.75; font-size: 10pt; text-align: justify; }
  .corpo p { margin-bottom: 7px; }
  .ck     { display: block; line-height: 1.65; }
  .ck-ind { display: block; line-height: 1.65; padding-left: 22px; }
  .sec    { font-weight: bold; display: block; margin-top: 4px; margin-bottom: 1px; }
  .ass    { margin-top: 36px; text-align: center; }
  .linha-ass { display: inline-block; width: 260px; border-top: 1.5px solid #000; margin-bottom: 3px; }

  /* ── Página 2 — Tabela de Equivalência ── */
  .page2 { page-break-before: always; padding-top: 4px; }
  .titulo-tab { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase;
                text-decoration: underline; margin: 10px 0 14px; }
  .tabela-equiv { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
  .tabela-equiv th, .tabela-equiv td { border: 1px solid #000; padding: 5px 8px; text-align: center; }
  .tabela-equiv th { font-weight: bold; background: #f0f0f0; }
  .tabela-equiv td:first-child { font-weight: bold; }
  .nota-tab { font-size: 9.5pt; text-align: justify; margin-top: 10px; line-height: 1.6; }
  .nota-tab p { margin-bottom: 5px; }
  .base-legal { font-size: 9.5pt; text-align: justify; margin-top: 8px; line-height: 1.55; }
`;

// ─── Cabeçalho institucional ──────────────────────────────────────────────────
const CABECALHO_HTML = `
  <div class="no-print"><button onclick="window.print()">🖨️ IMPRIMIR / SALVAR PDF</button></div>
  <div class="cab">
    <div class="cab-info">
      <p class="pref">Prefeitura do Município de Campos dos Goytacazes</p>
      <p class="pref">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
      <p class="escola">E. M. José Giró Faísca</p>
    </div>
    <img class="logo" src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo">
  </div>
  <div class="dados-inst">
    <p>Unidade Escolar: Escola Municipal José Giró Faísca</p>
    <p>Endereço: Rua São José s/nº - Travessão de Campos – Campos dos Goytacazes &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CEP 28175-000</p>
    <p>Identificação Única (Educacenso): 33011966 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Telefone Institucional: (22) 981310965</p>
    <p>E-mail Institucional: em.josegirofaisca@edu.campos.rj.gov.br</p>
    <p>CNPJ da Prefeitura Municipal de Campos dos Goytacazes: 29.116.894/0001-61</p>
  </div>
  <div class="titulo">Declaração de Comprovação Escolar</div>
`;

// ─── Página 2 — Tabela de Equivalência da Educação Infantil ──────────────────
const VERSO_HTML = `
  <div class="page2">
    <div class="cab">
      <div class="cab-info">
        <p class="pref">Prefeitura do Município de Campos dos Goytacazes</p>
        <p class="pref">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
        <p class="escola">E. M. José Giró Faísca</p>
      </div>
      <img class="logo" src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo">
    </div>

    <div class="titulo-tab">Tabela de Equivalência da Educação Infantil</div>

    <table class="tabela-equiv">
      <thead>
        <tr>
          <th>Denominação Interna</th>
          <th>Denominação Oficial (DCNEI / BNCC)</th>
          <th>Faixa Etária</th>
          <th>Etapa</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>G1</td>
          <td>Creche — Berçário I</td>
          <td>0 a 1 ano</td>
          <td>Creche</td>
        </tr>
        <tr>
          <td>G2</td>
          <td>Creche — Berçário II</td>
          <td>1 a 2 anos</td>
          <td>Creche</td>
        </tr>
        <tr>
          <td>G3</td>
          <td>Creche — Maternal</td>
          <td>2 a 3 anos</td>
          <td>Creche</td>
        </tr>
        <tr>
          <td>P1</td>
          <td>Pré-Escola — 1º Período</td>
          <td>4 a 5 anos</td>
          <td>Pré-Escola</td>
        </tr>
        <tr>
          <td>P2</td>
          <td>Pré-Escola — 2º Período</td>
          <td>5 a 6 anos</td>
          <td>Pré-Escola</td>
        </tr>
      </tbody>
    </table>
  </div>
`;

// ─── Gerador único de HTML ────────────────────────────────────────────────────
interface DeclarParams {
  aluno: any;
  naturalidade: string;
  nivel: "infantil" | "fundamental";
  situacao: "matriculado(a)" | "matriculado e frequentando" | "cursou";
  objetivo: string;
  serieInfantil?: string;
  anoLetivo?: string;
  anoEscolar?: string;
  resultado?: string;
  dataTransf?: string;
  progressaoComps?: string;
  anoReclassif?: string;
  matriculadoEm?: string;
}

function gerarHtml(p: DeclarParams): string {
  const nomePai = (!p.aluno.nomePai
    || p.aluno.nomePai.trim() === ""
    || p.aluno.nomePai.toLowerCase().includes("não informado")
    || p.aluno.nomePai === "-")
    ? "-" : p.aluno.nomePai;

  const nomePaiStr = nomePai === "-"
    ? "e de <strong>-</strong>"
    : `e de <strong>${nomePai}</strong>`;

  const naturalStr = (p.naturalidade || "").trim() || "___________________________";

  const isInf  = p.nivel === "infantil";
  const isFund = p.nivel === "fundamental";

  // Marks helpers — sem espaço extra dentro dos parênteses
  function xm(v: boolean) { return v ? "(x)" : "( )"; }

  // ── INFANTIL section ──
  const serie     = p.serieInfantil || "";
  const infMat    = isInf && p.situacao === "matriculado(a)";
  const infFreq   = isInf && p.situacao === "matriculado e frequentando";
  const infCursou = isInf && p.situacao === "cursou";

  const infSituacaoLine =
    `Encontra-se: ${xm(infMat)} matriculado(a) &nbsp; ${xm(infFreq)} matriculado e frequentando &nbsp; ${infCursou ? "(x)" : "( )"} cursou`;

  const infG1 = isInf && serie === "G1";
  const infG2 = isInf && serie === "G2";
  const infG3 = isInf && serie === "G3";
  const infP1 = isInf && serie === "P1";
  const infP2 = isInf && serie === "P2";

  // Espaçamento via tabela para alinhamento uniforme das colunas
  const infLinha1 = `${xm(infG1)}&nbsp;G1 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${xm(infG3)}&nbsp;G3 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${xm(infP2)}&nbsp;P2`;
  const infLinha2 = `${xm(infG2)}&nbsp;G2 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${xm(infP1)}&nbsp;P1`;

  // ── FUNDAMENTAL section ──
  const anoEsc   = p.anoEscolar  || "___";
  const anoLet   = p.anoLetivo   || "____";
  const resVal   = (p.resultado  || "").toLowerCase();
  const matEm    = (p.matriculadoEm || "").trim() || "_____________________________";

  const fundMat   = isFund && p.situacao === "matriculado(a)";
  const fundFreq  = isFund && p.situacao === "matriculado e frequentando";
  const fundCur   = isFund && p.situacao === "cursou";

  const isContinu = fundCur && resVal === "em continuidade de estudo";
  const isAprov   = fundCur && resVal === "aprovado(a)";
  const isProgres = fundCur && resVal === "aprovado com progressão parcial";
  const isReprov  = fundCur && resVal === "reprovado";
  const isReprovF = fundCur && resVal === "reprovado por frequência";
  const isReclass = fundCur && resVal.includes("reclassificado");
  const isDefrq   = fundCur && resVal === "deixou de frequentar";
  const isTransf  = fundCur && resVal === "transferido";

  const progCompsStr = (p.progressaoComps || "").trim()
    || "____________________________________________________________";
  const anoReclStr   = (p.anoReclassif || "").trim() || "___";
  const dataTransfStr = (p.dataTransf   || "").trim() || "___/___/___";

  const fundCursouLinhaPrincipal = fundCur
    ? `(x) Cursou no ano letivo de ${anoLet} (ano/semestre), o/a ${anoEsc} ano de escolaridade/fase do Ensino Fundamental, tendo sido considerado(a):`
    : `( ) Cursou no ano letivo de ____ (ano/semestre), o/a ___ ano de escolaridade/fase do Ensino Fundamental, tendo sido considerado(a):`;

  return `<!DOCTYPE html><html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Declaração — ${p.aluno.nomeCompleto}</title>
  <style>${CSS_DOC}</style>
</head>
<body>
${CABECALHO_HTML}
<div class="corpo">
  <p>Declaramos para os devidos fins que o(a) aluno(a) <strong>${p.aluno.nomeCompleto}</strong>,
  nascido(a) em <strong>${p.aluno.dataNascimento || "___/___/______"}</strong>,
  filho(a) de <strong>${p.aluno.nomeMae || "___________________________"}</strong> ${nomePaiStr},
  natural de <strong>${naturalStr}</strong>,
  está/esteve regularmente matriculado(a) nesta Unidade Escolar.</p>

  <p>
    <span class="sec">Educação Infantil: (Vide Verso)</span>
    <span class="ck">${infSituacaoLine}</span>
    <span class="ck">${infLinha1}</span>
    <span class="ck">${infLinha2}</span>
  </p>

  <p>
    <span class="sec">Ensino Fundamental:</span>
    <span class="ck">${xm(fundMat)} Encontra-se matriculado no/a ${fundMat ? anoEsc : "___"} ano de escolaridade/fase do Ensino Fundamental.</span>
    <span class="ck">${xm(fundFreq)} Encontra-se matriculado(a) e frequentando o/a ${fundFreq ? anoEsc : "___"} ano de escolaridade/fase do Ensino Fundamental.</span>
    <span class="ck">${fundCursouLinhaPrincipal}</span>
    <span class="ck-ind">${xm(isContinu)} Em Continuidade de Estudo</span>
    <span class="ck-ind">${xm(isAprov)} Aprovado(a)</span>
    <span class="ck-ind">${xm(isProgres)} Aprovado com Progressão Parcial em ${isProgres ? progCompsStr : "____________________________________________________________"}
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(citar o(s) Componente(s) Curricular(es) e Ano de Escolaridade/Fase da Progressão Parcial).</span>
    <span class="ck-ind">${xm(isReprov)} Reprovado;</span>
    <span class="ck-ind">${xm(isReclass)} Reprovado por frequência – Reclassificado pela Resolução Seduct nº 03/2024 – Amparado a cursar o/a ${isReclass ? anoReclStr : "___"} ano de escolaridade/fase do Ensino Fundamental.</span>
    <span class="ck-ind">${xm(isReprovF)} Reprovado por frequência.</span>
    <span class="ck-ind">${xm(isDefrq)} Deixou de frequentar.</span>
    <span class="ck-ind">${xm(isTransf)} Transferido em ${isTransf ? dataTransfStr : "___/___/___"}.</span>
    <span class="ck" style="margin-top:5px;">O(a) aluno(a) deverá ser matriculado(a) no(a) ${matEm}.</span>
  </p>

  <p>Esta declaração é expedida a pedido da parte interessada, para fins de:<br>
  <strong>${p.objetivo || "_______________________________________________________________"}</strong></p>

  <p>Campos dos Goytacazes, ${dataPorExtenso()}.</p>
</div>
<div class="ass"><div class="linha-ass"></div><br><strong>E. M. José Giró Faísca</strong><br>Direção / Coordenação Pedagógica</div>

${VERSO_HTML}
</body></html>`;
}

// ─── Seção: Declarações ───────────────────────────────────────────────────────
function SecaoDeclaracoes() {
  const { data: todosAlunos, isLoading } = useListarAlunos();
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);

  const [busca, setBusca]           = useState("");
  const [alunoSel, setAlunoSel]     = useState<any>(null);
  const [showSug, setShowSug]       = useState(false);
  const [naturalidade, setNaturalidade] = useState("");
  const [objetivo, setObjetivo]     = useState("");
  const [nivel, setNivel]           = useState<"" | "infantil" | "fundamental">("");
  const [situacao, setSituacao]     = useState<"" | "matriculado(a)" | "matriculado e frequentando" | "cursou">("");

  const [serieCursou, setSerieCursou]       = useState("");
  const [anoLetivo, setAnoLetivo]           = useState("");
  const [anoEscolar, setAnoEscolar]         = useState("");
  const [resultado, setResultado]           = useState("");
  const [dataTransf, setDataTransf]         = useState("");
  const [progressaoComps, setProgressaoComps] = useState("");
  const [anoReclassif, setAnoReclassif]     = useState("");
  const [matriculadoEm, setMatriculadoEm]   = useState("");

  const sugestoes = useMemo(() => {
    if (!busca || busca.length < 2) return [];
    const q = busca.toLowerCase();
    return (todosAlunos ?? []).filter(a =>
      a.nomeCompleto.toLowerCase().includes(q) || (a.matricula ?? "").includes(q)
    ).slice(0, 8);
  }, [busca, todosAlunos]);

  function selecionarAluno(a: any) {
    setAlunoSel(a);
    setBusca(a.nomeCompleto);
    setShowSug(false);
    setNaturalidade(a.naturalidade || "Campos dos Goytacazes/RJ");
    resetTipo();
    
    // Auto-detectar nível
    const n = detectarNivel(a.turmaAtual || "");
    if (n) setNivel(n);
  }

  function resetTipo() {
    setNivel(""); setSituacao(""); setSerieCursou("");
    setAnoLetivo(""); setAnoEscolar(""); setResultado("");
    setDataTransf(""); setProgressaoComps(""); setAnoReclassif("");
    setMatriculadoEm("");
  }

  function escolherNivel(n: "infantil" | "fundamental") {
    setNivel(n); setSituacao("");
    setSerieCursou(""); setAnoLetivo(""); setAnoEscolar(""); setResultado("");
    setDataTransf(""); setProgressaoComps(""); setAnoReclassif(""); setMatriculadoEm("");
  }

  function escolherSituacao(s: "matriculado(a)" | "matriculado e frequentando" | "cursou") {
    setSituacao(s);
    setSerieCursou(""); setAnoLetivo(""); setAnoEscolar(""); setResultado("");
    setDataTransf(""); setProgressaoComps(""); setAnoReclassif(""); setMatriculadoEm("");
  }

  const isCursou  = situacao === "cursou";
  const isMatAuto = nivel && situacao && situacao !== "cursou";

  const serieInfantil = isCursou && nivel === "infantil"
    ? serieCursou
    : (nivel === "infantil" && alunoSel ? detectarSerieInfantil(alunoSel.turmaAtual || "") : "");

  const anoEscolarFinal = isCursou && nivel === "fundamental"
    ? anoEscolar
    : (nivel === "fundamental" && alunoSel ? extrairAnoFundamental(alunoSel.turmaAtual || "") : "");

  const precisaTransf   = resultado === "transferido";
  const precisaProgressao = resultado === "aprovado com progressão parcial";
  const precisaReclass  = resultado.includes("reclassificado");

  const podeGerar = !!alunoSel && !!objetivo && !!nivel && !!situacao && (
    (nivel === "infantil" && isCursou)  ? !!serieCursou :
    (nivel === "fundamental" && isCursou) ?
      !!anoLetivo && !!anoEscolar && !!resultado &&
      (!precisaTransf || !!dataTransf) &&
      (!precisaProgressao || !!progressaoComps) &&
      (!precisaReclass || !!anoReclassif)
    : true
  );

  function gerarDeclaracao() {
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  async function imprimirNaRicoh() {
    if (!alunoSel || !nivel || !situacao) return;
    setImprimindoRicoh(true);
    try {
      const html = gerarHtml({
        aluno: alunoSel,
        naturalidade,
        nivel: nivel as "infantil" | "fundamental",
        situacao: situacao as "matriculado(a)" | "matriculado e frequentando" | "cursou",
        objetivo,
        serieInfantil: nivel === "infantil" ? serieInfantil : undefined,
        anoLetivo:     nivel === "fundamental" ? anoLetivo : undefined,
        anoEscolar:    nivel === "fundamental" ? anoEscolarFinal : undefined,
        resultado:     nivel === "fundamental" ? resultado : undefined,
        dataTransf:    precisaTransf ? dataTransf : undefined,
        progressaoComps: precisaProgressao ? progressaoComps : undefined,
        anoReclassif:  precisaReclass ? anoReclassif : undefined,
        matriculadoEm: nivel === "fundamental" ? matriculadoEm : undefined,
      });

      // Criar um arquivo temporário para enviar
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Declaracao_${alunoSel.nomeCompleto.replace(/\s+/g, "_")}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar para impressora");

      alert("Enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao tentar imprimir diretamente.");
    } finally {
      setImprimindoRicoh(false);
    }
  }

  // UI helpers
  const btnBase = "text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200";
  const btnOff  = `${btnBase} bg-[#0f172a] border-[#334155] text-slate-300`;

  function btnCls(active: boolean, cor: "blue" | "violet" | "emerald" | "cyan" | "orange") {
    const onMap: Record<string, string> = {
      blue:    "bg-blue-500/20 border-blue-500 text-blue-300",
      violet:  "bg-violet-500/20 border-violet-500 text-violet-300",
      emerald: "bg-emerald-500/20 border-emerald-500 text-emerald-300",
      cyan:    "bg-cyan-500/20 border-cyan-500 text-cyan-300",
      orange:  "bg-orange-500/20 border-orange-500 text-orange-300",
    };
    const hoverMap: Record<string, string> = {
      blue:    "hover:border-blue-500/50 hover:text-blue-200",
      violet:  "hover:border-violet-500/50 hover:text-violet-200",
      emerald: "hover:border-emerald-500/50 hover:text-emerald-200",
      cyan:    "hover:border-cyan-500/50 hover:text-cyan-200",
      orange:  "hover:border-orange-500/50 hover:text-orange-200",
    };
    return active ? `${btnBase} ${onMap[cor]}` : `${btnOff} ${hoverMap[cor]}`;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#1e293b] p-8 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-8">

        {/* 01 — Aluno */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <span className="text-blue-400">01.</span> Selecione o Aluno
          </Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Digite o nome ou matrícula..."
              className="pl-11 h-12 bg-[#0f172a] border-[#334155] focus-visible:border-blue-500 focus-visible:ring-blue-500/20 text-white rounded-xl"
              value={busca}
              onChange={e => { setBusca(e.target.value); setAlunoSel(null); setShowSug(true); }}
              onFocus={() => setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              disabled={isLoading}
            />
            {isLoading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />}
            {showSug && sugestoes.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                {sugestoes.map(a => (
                  <button key={a.id} className="w-full text-left px-4 py-3 hover:bg-blue-500/20 transition-colors flex items-center justify-between group" onMouseDown={() => selecionarAluno(a)}>
                    <div>
                      <span className="font-medium text-white uppercase">{a.nomeCompleto}</span>
                      <span className="text-xs text-slate-500 ml-2">{a.matricula}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono group-hover:text-blue-300">{a.turmaAtual || "S/T"}</span>
                      <ChevronRight className="h-3 w-3 text-slate-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {alunoSel && (
            <div className="mt-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-blue-500/30 flex items-center justify-center font-black text-lg text-white shrink-0">
                {alunoSel.nomeCompleto[0]}
              </div>
              <div className="text-sm flex-1">
                <p className="font-bold text-white uppercase">{alunoSel.nomeCompleto}</p>
                <p className="text-blue-300 mt-0.5 text-xs">
                  Turma <strong>{alunoSel.turmaAtual || "S/T"}</strong>
                  {alunoSel.turno ? ` · ${alunoSel.turno}` : ""}
                  {alunoSel.nomeMae ? ` · Mãe: ${alunoSel.nomeMae}` : ""}
                  {alunoSel.dataNascimento ? ` · Nasc: ${alunoSel.dataNascimento}` : ""}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* 02 — PARA FINS DE */}
        {alunoSel && (
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <span className="text-blue-400">02.</span> Para Fins de
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OBJETIVOS.map(obj => (
                <button
                  key={obj}
                  onClick={() => setObjetivo(obj)}
                  className={btnCls(objetivo === obj, "cyan")}
                >
                  {obj.charAt(0).toUpperCase() + obj.slice(1)}
                </button>
              ))}
            </div>
            {objetivo && (
              <p className="text-xs text-cyan-400/70 mt-1">
                Selecionado: <strong>{objetivo}</strong>
              </p>
            )}
          </div>
        )}

        {/* 03 — Situação do Aluno (Auto-detectado) */}
        {alunoSel && objetivo && nivel && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <span className="text-blue-400">03.</span> Situação do Aluno
              <span className="ml-auto text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase">
                {nivel === "infantil" ? "Educação Infantil" : "Ensino Fundamental"}
              </span>
            </Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(["matriculado(a)", "matriculado e frequentando", "cursou"] as const).map(s => (
                <button key={s} onClick={() => escolherSituacao(s)}
                  className={btnCls(situacao === s, nivel === "infantil" ? "violet" : "emerald")}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Ano auto-detectado (mat / mat+freq) */}
            {isMatAuto && nivel === "infantil" && serieInfantil && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                <span>Série detectada automaticamente:</span>
                <strong className="text-base">{serieInfantil}</strong>
              </div>
            )}
            {isMatAuto && nivel === "infantil" && !serieInfantil && alunoSel && (
              <p className="text-xs text-yellow-400/80 px-1">
                ⚠ Não foi possível detectar a série na turma "{alunoSel.turmaAtual}". Verifique o cadastro do aluno.
              </p>
            )}
            {isMatAuto && nivel === "fundamental" && anoEscolarFinal !== "___" && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <span>Ano detectado automaticamente:</span>
                <strong className="text-base">{anoEscolarFinal}</strong>
              </div>
            )}
            {isMatAuto && nivel === "fundamental" && anoEscolarFinal === "___" && alunoSel && (
              <p className="text-xs text-yellow-400/80 px-1">
                ⚠ Não foi possível detectar o ano na turma "{alunoSel.turmaAtual}". Verifique o cadastro do aluno.
              </p>
            )}
          </div>
        )}

        {/* 05 — Infantil Cursou: escolher série */}
        {nivel === "infantil" && isCursou && (
          <div className="space-y-2 p-4 bg-violet-500/5 border border-violet-500/20 rounded-xl">
            <Label className="text-xs font-bold uppercase tracking-widest text-violet-400">
              Série que o aluno cursou
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {SERIES_INFANTIL.map(s => (
                <button key={s} onClick={() => setSerieCursou(s)}
                  className={btnCls(serieCursou === s, "violet") + " text-center justify-center py-3 font-bold"}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 05 — Fundamental Cursou: campos */}
        {nivel === "fundamental" && isCursou && (
          <div className="space-y-5 p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Dados do ano cursado
            </p>

            {/* Ano letivo + Ano de escolaridade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-widest">Ano Letivo</Label>
                <Input placeholder="Ex: 2024" className="h-11 bg-[#0f172a] border-[#334155] focus-visible:border-emerald-500 text-white rounded-xl"
                  value={anoLetivo} onChange={e => setAnoLetivo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-widest">Ano de Escolaridade</Label>
                <div className="grid grid-cols-5 gap-1">
                  {ANOS_FUNDAMENTAL.map(a => (
                    <button key={a} onClick={() => setAnoEscolar(a)}
                      className={btnCls(anoEscolar === a, "emerald") + " text-center justify-center py-2 text-xs font-bold"}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado Final */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 uppercase tracking-widest">Resultado Final</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RESULTADOS_FUND.map(r => (
                  <button key={r.valor} onClick={() => setResultado(r.valor)}
                    className={btnCls(resultado === r.valor, "emerald")}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Progressão Parcial — componentes */}
            {precisaProgressao && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-widest">
                  Componentes Curriculares da Progressão Parcial
                </Label>
                <Input
                  placeholder="Ex: Matemática – 3º ano; Português – 3º ano"
                  className="h-11 bg-[#0f172a] border-[#334155] focus-visible:border-emerald-500 text-white rounded-xl"
                  value={progressaoComps}
                  onChange={e => setProgressaoComps(e.target.value)}
                />
              </div>
            )}

            {/* Reclassificado — próximo ano */}
            {precisaReclass && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-widest">
                  Amparado a cursar — Ano de Escolaridade
                </Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {ANOS_FUNDAMENTAL.map(a => (
                    <button key={a} onClick={() => setAnoReclassif(a)}
                      className={btnCls(anoReclassif === a, "orange") + " text-center justify-center py-2 text-xs font-bold"}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transferido — data */}
            {precisaTransf && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400 uppercase tracking-widest">Data da Transferência</Label>
                <Input
                  placeholder="Ex: 15/06/2024"
                  className="h-11 bg-[#0f172a] border-[#334155] focus-visible:border-emerald-500 text-white rounded-xl"
                  value={dataTransf}
                  onChange={e => setDataTransf(e.target.value)}
                />
              </div>
            )}

            {/* Deverá ser matriculado em */}
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400 uppercase tracking-widest">
                O(a) aluno(a) deverá ser matriculado(a) no(a) <span className="text-slate-600 normal-case">(opcional)</span>
              </Label>
              <Input
                placeholder="Ex: 4º ano do Ensino Fundamental"
                className="h-11 bg-[#0f172a] border-[#334155] focus-visible:border-emerald-500 text-white rounded-xl"
                value={matriculadoEm}
                onChange={e => setMatriculadoEm(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Botão Gerar */}
        {alunoSel && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={gerarDeclaracao}
              disabled={!podeGerar}
              className="flex-1 h-14 text-base font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all gap-2"
            >
              <FileText className="h-5 w-5" />
              Gerar Declaração
            </Button>

            {isMaster && (
              <Button
                onClick={imprimirNaRicoh}
                disabled={!podeGerar || imprimindoRicoh}
                className="flex-1 h-14 text-base font-black bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all gap-2 border-2 border-primary/20"
              >
                {imprimindoRicoh ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Printer className="h-5 w-5" />
                )}
                IMPRIMIR NA RICOH
              </Button>
            )}
          </div>
        )}

        {/* Dicas de preenchimento */}
        {!podeGerar && alunoSel && (
          <p className="text-xs text-slate-500 text-center -mt-4">
            {!objetivo ? "Selecione a finalidade da declaração" :
             !nivel    ? "Selecione o nível de ensino" :
             !situacao ? "Selecione a situação do aluno" :
             (nivel === "infantil" && isCursou && !serieCursou) ? "Selecione a série que o aluno cursou" :
             (nivel === "fundamental" && isCursou && !anoLetivo) ? "Informe o ano letivo" :
             (nivel === "fundamental" && isCursou && !anoEscolar) ? "Selecione o ano de escolaridade" :
             (nivel === "fundamental" && isCursou && !resultado) ? "Selecione o resultado final" :
             (precisaTransf && !dataTransf) ? "Informe a data de transferência" :
             (precisaProgressao && !progressaoComps) ? "Informe os componentes da progressão parcial" :
             (precisaReclass && !anoReclassif) ? "Selecione o ano de escolaridade para reclassificação" :
             "Preencha todos os campos obrigatórios"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Pré-Diário: gerador de HTML ─────────────────────────────────────────────
function gerarHtmlPreDiario(dados: any[]): string {

  const CSS = `
    @page { size: A4 landscape; margin: 1.2cm 1.5cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; color: #000; background: #fff; }
    .no-print { display: flex; gap: 8px; margin-bottom: 10px; padding: 8px;
                background: #f0f0f0; border-radius: 5px; align-items: center; }
    .no-print button { padding: 7px 18px; cursor: pointer; font-weight: bold;
                       border-radius: 4px; border: none; font-size: 13px;
                       background: #10b981; color: #fff; }
    .no-print span { font-size: 11px; color: #555; }
    @media print {
      .no-print { display: none !important; }
      .turma-bloco { page-break-after: always; break-after: page; }
    }
    .turma-bloco:last-child { page-break-after: auto; break-after: auto; }

    /* Cabeçalho da turma */
    .cab-turma { border: 1.5px solid #000; margin-bottom: 5px; }
    .cab-top { display: flex; align-items: center; gap: 8px;
               border-bottom: 1px solid #000; padding: 5px 8px; }
    .logo-pd { width: 52px; height: 52px; object-fit: contain; }
    .cab-inst { flex: 1; }
    .cab-inst p { margin: 1px 0; font-size: 7.5pt; }
    .cab-inst .escola { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; }
    .cab-inst .doc-tit { font-size: 9pt; font-weight: bold; text-transform: uppercase;
                         text-align: center; letter-spacing: 0.5px; }
    .mes-destaque { font-size: 10.5pt; font-weight: 900; color: #1a3a5c;
                    letter-spacing: 1px; text-transform: uppercase; }
    .cab-bot { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0;
               font-size: 7.5pt; }
    .cab-bot div { border-right: 1px solid #000; padding: 4px 8px; }
    .cab-bot div:last-child { border-right: none; }
    .cab-bot label { font-weight: bold; font-size: 6.5pt; text-transform: uppercase;
                     display: block; color: #444; margin-bottom: 2px; }

    /* Tabela principal */
    .tabela { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
    .tabela th, .tabela td {
      border: 0.5px solid #000; text-align: center; vertical-align: middle;
      padding: 1px; overflow: hidden;
    }
    .th-n     { width: 16px; font-size: 6pt; }
    .th-nome  { width: 185px; text-align: left !important; padding-left: 4px !important; }
    .th-mes   { font-size: 6.5pt; font-weight: 900; text-transform: uppercase;
                letter-spacing: 0.5px; padding: 3px 2px;
                background: #1a3a5c; color: #fff; }
    .th-dia   { width: 10px; font-size: 5.5pt; font-weight: bold; background: #f0f4f8; }
    .th-sep   { width: 5px; background: #1a3a5c; border-color: #1a3a5c; padding: 0; }
    .td-n     { font-size: 6pt; color: #444; }
    .td-nome  { text-align: left !important; padding-left: 4px !important; font-size: 6.5pt;
                white-space: normal; word-break: break-word; line-height: 1.3; }
    .td-vazio { height: 15px; }
    .td-sep   { background: #1a3a5c; border-color: #1a3a5c; padding: 0; }
    tr:nth-child(even) .td-nome { background: #fafafa; }
    tr:nth-child(even) .td-n    { background: #fafafa; }

    /* Rodapé */
    .rodape { margin-top: 14px; display: flex; gap: 30px; }
    .linha-ass { flex: 1; border-top: 1px solid #000; text-align: center;
                 font-size: 7pt; padding-top: 3px; margin-top: 22px; }
  `;

  function extrairDia(d: string): string {
    if (!d || d === "___") return "—";
    return d.split("/")[0] || d;
  }

  function blocoTurma(bloco: any): string {
    const { turma, alunos } = bloco;

    // Suporta estrutura nova com grupos ou legada com datasLetivas
    let grupos: { nomeMes: string; datas: { data: string; aulas: number }[] }[];
    if (bloco.grupos && bloco.grupos.length > 0) {
      grupos = bloco.grupos;
    } else {
      const dl = bloco.datasLetivas;
      const datas = (dl && dl.length > 0)
        ? dl
        : Array.from({ length: 25 }, () => ({ data: "___", aulas: 1 }));
      grupos = [{ nomeMes: "", datas }];
    }

    const tituloMeses = grupos.map(g => g.nomeMes).filter(Boolean).join(" / ");
    const multiGrupo  = grupos.length > 1;

    // Thead linha 1: células de mês mescladas + coluna separadora entre grupos
    const headerMeses = grupos.map((g, gi) => {
      const n = g.datas.length;
      const sep = (multiGrupo && gi > 0) ? `<th rowspan="2" class="th-sep"></th>` : "";
      const cel = g.nomeMes
        ? `<th class="th-mes" colspan="${n}">${g.nomeMes}</th>`
        : `<th colspan="${n}" style="background:#f5f5f5;"></th>`;
      return sep + cel;
    }).join("");

    // Thead linha 2: somente os dias (separador já ocupa esta linha via rowspan=2)
    const headerDias = grupos.flatMap(g =>
      g.datas.map(d => `<th class="th-dia">${extrairDia(d.data)}</th>`)
    ).join("");

    // Células de dados por linha de aluno
    const celulasMes = (g: { datas: any[] }, gi: number) => {
      const sep = (multiGrupo && gi > 0) ? `<td class="td-sep"></td>` : "";
      return sep + g.datas.map(() => `<td class="td-vazio"></td>`).join("");
    };

    const MINIMO_LINHAS = 20;
    const linhasAlunos = alunos.map((a: any) =>
      `<tr>
        <td class="td-n">${a.n}</td>
        <td class="td-nome">${a.nome}</td>
        ${grupos.map((g, gi) => celulasMes(g, gi)).join("")}
      </tr>`
    ).join("");

    const linhasExtras = alunos.length < MINIMO_LINHAS
      ? Array.from({ length: MINIMO_LINHAS - alunos.length }, (_, i) =>
          `<tr>
            <td class="td-n" style="color:#bbb">${alunos.length + i + 1}</td>
            <td class="td-nome"></td>
            ${grupos.map((g, gi) => celulasMes(g, gi)).join("")}
          </tr>`
        ).join("")
      : "";

    return `
      <div class="turma-bloco">
        <div class="cab-turma">
          <div class="cab-top">
            <img class="logo-pd" src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo">
            <div class="cab-inst">
              <p>Prefeitura Municipal de Campos dos Goytacazes — Secretaria Municipal de Educação, Ciência e Tecnologia</p>
              <p class="escola">E. M. José Giró Faísca</p>
              <p class="doc-tit">Pré-Diário de Classe
                ${tituloMeses ? `— <span class="mes-destaque">${tituloMeses}</span>` : ""}
              </p>
            </div>
          </div>
          <div class="cab-bot">
            <div><label>Turma</label>${turma.nome}</div>
            <div><label>Turno</label>${turma.turno || "___"}</div>
            <div><label>Professor(a)</label>${turma.professor || "___"}</div>
            <div><label>Total de alunos</label>${alunos.length}</div>
          </div>
        </div>

        <table class="tabela">
          <thead>
            <tr>
              <th class="th-n" rowspan="2">Nº</th>
              <th class="th-nome" rowspan="2">Nome do Aluno</th>
              ${headerMeses}
            </tr>
            <tr>
              ${headerDias}
            </tr>
          </thead>
          <tbody>
            ${linhasAlunos}
            ${linhasExtras}
          </tbody>
        </table>

        <div class="rodape">
          <div class="linha-ass">Professor(a) Responsável</div>
          <div class="linha-ass">Coordenação Pedagógica</div>
          <div class="linha-ass">Data: ___/___/______</div>
        </div>
      </div>
    `;
  }

  const corpo = dados.map(blocoTurma).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pré-Diário — E.M. José Giró Faísca</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ IMPRIMIR / SALVAR PDF</button>
    <span>Use o modo paisagem (A4 Paisagem) ao imprimir para melhor resultado.</span>
  </div>
  ${corpo}
</body>
</html>`;
}

// ─── Componente: Seção de Dias Especiais (Pré-Diário) ───────────────────────
function SecaoDiasEspeciaisPD({
  titulo, cor, diasNoMes, ano, mes,
  itens, onAdd, onRemove, onUpdate,
}: {
  titulo: string;
  cor: "amber" | "red";
  diasNoMes: number;
  ano: number;
  mes: number; // 0-indexed
  itens: DiaEspecialPD[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, campo: "dia" | "nome", valor: string | number) => void;
}) {
  const isAmber  = cor === "amber";
  const borderCl = isAmber ? "border-amber-500/25" : "border-red-500/25";
  const bgCl     = isAmber ? "bg-amber-500/5"      : "bg-red-500/5";
  const titleCl  = isAmber ? "text-amber-400"      : "text-red-400";
  const badgeBg  = isAmber ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300";
  const btnCl    = isAmber
    ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
    : "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25";
  const itemBg   = isAmber ? "bg-amber-500/8 border-amber-500/15" : "bg-red-500/8 border-red-500/15";
  const DIAS_SEM = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  return (
    <div className={`rounded-xl border ${borderCl} ${bgCl} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <span className={`text-[0.7rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${badgeBg}`}>
            {isAmber ? "RECESSO" : "FERIADO"}
          </span>
          <div>
            <p className={`text-sm font-bold ${titleCl}`}>{titulo}</p>
            <p className="text-[0.68rem] text-white/35 leading-tight">
              {itens.length === 0 ? "Nenhum dia configurado" : `${itens.length} dia${itens.length !== 1 ? "s" : ""} no mês`}
            </p>
          </div>
        </div>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-bold transition-colors ${btnCl}`}
        >
          <Plus className="h-3.5 w-3.5" />Adicionar
        </button>
      </div>

      {itens.length > 0 && (
        <div className="p-3 space-y-2">
          {itens.map(item => {
            const date = new Date(ano, mes, item.dia);
            const dow  = DIAS_SEM[date.getDay()];
            return (
              <div key={item.id} className={`flex items-center gap-3 rounded-lg border ${itemBg} px-3 py-2`}>
                <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-12 rounded-lg ${badgeBg} select-none`}>
                  <span className="text-xl font-black leading-none">{String(item.dia).padStart(2, "0")}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-75">{dow}</span>
                </div>
                <select
                  value={item.dia}
                  onChange={e => onUpdate(item.id, "dia", Number(e.target.value))}
                  className="w-[110px] px-2 py-1.5 rounded-lg text-xs border border-white/10 focus:border-orange-500 focus:outline-none cursor-pointer"
                  style={{ background: "#1e293b", color: "#fff" }}
                >
                  {Array.from({ length: diasNoMes }, (_, i) => i + 1).map(d => {
                    const dt = new Date(ano, mes, d);
                    const dw = DIAS_SEM[dt.getDay()];
                    return <option key={d} value={d} style={{ background: "#1e293b", color: "#fff" }}>{String(d).padStart(2, "0")} — {dw}</option>;
                  })}
                </select>
                <input
                  type="text"
                  value={item.nome}
                  onChange={e => onUpdate(item.id, "nome", e.target.value)}
                  placeholder="Nome do evento"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 text-white text-sm border border-white/10 focus:border-orange-500 focus:outline-none placeholder:text-white/25"
                />
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
          Clique em "Adicionar" para incluir um {isAmber ? "recesso" : "feriado"} extra no mês
        </p>
      )}
    </div>
  );
}

// ─── Seção Pré-Diário ─────────────────────────────────────────────────────────
function useDiasEspeciaisMes(mesSel: number, anoSel: number) {
  const [feriados, setFeriados] = useState<DiaEspecialPD[]>([]);
  const [recessos, setRecessos] = useState<DiaEspecialPD[]>([]);
  const primeiro = useRef(true);

  const nacionaisDoMes = useMemo(() => {
    const result: { dia: number; nome: string }[] = [];
    for (const [chave, nome] of Object.entries(FERIADOS_NACIONAIS_PD)) {
      const [a, m, d] = chave.split("-").map(Number);
      if (a === anoSel && m - 1 === mesSel) result.push({ dia: d, nome });
    }
    return result.sort((x, y) => x.dia - y.dia);
  }, [mesSel, anoSel]);

  useEffect(() => {
    const inicial = nacionaisDoMes.map((f, i) => ({
      id: `fn-${i}-${f.dia}`, dia: f.dia, nome: f.nome, tipo: "feriado" as const,
    }));
    setFeriados(inicial);
    if (!primeiro.current) setRecessos([]);
    primeiro.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesSel, anoSel]);

  const addFeriado   = () => setFeriados(p => [...p, { id: `f-${Date.now()}`, dia: 1, nome: "", tipo: "feriado" }]);
  const removeFeriado = (id: string) => setFeriados(p => p.filter(f => f.id !== id));
  const updateFeriado = (id: string, campo: "dia" | "nome", valor: string | number) =>
    setFeriados(p => p.map(f => f.id === id ? { ...f, [campo]: valor } : f));

  const addRecesso   = () => setRecessos(p => [...p, { id: `r-${Date.now()}`, dia: 1, nome: "Recesso Escolar", tipo: "recesso" }]);
  const removeRecesso = (id: string) => setRecessos(p => p.filter(r => r.id !== id));
  const updateRecesso = (id: string, campo: "dia" | "nome", valor: string | number) =>
    setRecessos(p => p.map(r => r.id === id ? { ...r, [campo]: valor } : r));

  const diasNoMes = new Date(anoSel, mesSel + 1, 0).getDate();

  const previewCount = useMemo(() => {
    const excl = new Set([...feriados.map(f => f.dia), ...recessos.map(r => r.dia)]);
    let c = 0;
    for (let d = 1; d <= diasNoMes; d++) {
      if (excl.has(d)) continue;
      const dow = new Date(anoSel, mesSel, d).getDay();
      if (dow === 0 || dow === 6) continue;
      c++;
    }
    return c;
  }, [mesSel, anoSel, diasNoMes, feriados, recessos]);

  return { feriados, recessos, diasNoMes, previewCount,
           addFeriado, removeFeriado, updateFeriado,
           addRecesso, removeRecesso, updateRecesso };
}

function SecaoPreDiario() {
  const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
  const hoje = new Date();

  type AlunoRev = { tmpId: string; n: number; nome: string; ativo: boolean };
  type BlocoRev = { turma: any; alunos: AlunoRev[]; grupos: any[] };

  const [turmas, setTurmas]         = useState<any[]>([]);
  const [turmasSel, setTurmasSel]   = useState<Set<string>>(new Set()); // vazio = todas
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState("");
  const [segundoMes, setSegundoMes] = useState(false);
  const [dadosRevisao, setDadosRevisao] = useState<BlocoRev[] | null>(null);
  const [editandoNome, setEditandoNome] = useState<string | null>(null); // tmpId sendo editado

  // Mês 1
  const [mesSel, setMesSel]   = useState(hoje.getMonth());
  const [anoSel, setAnoSel]   = useState(hoje.getFullYear());
  const m1 = useDiasEspeciaisMes(mesSel, anoSel);

  // Mês 2
  const [mesSel2, setMesSel2] = useState((hoje.getMonth() + 1) % 12);
  const [anoSel2, setAnoSel2] = useState(hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear());
  const m2 = useDiasEspeciaisMes(mesSel2, anoSel2);

  useEffect(() => {
    fetch(`${BASE}api/turmas`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setTurmas(Array.isArray(d) ? d : d.turmas || []))
      .catch(() => {});
  }, [BASE]);

  async function buscarMes(mes0idx: number, ano: number, feriados: DiaEspecialPD[], recessos: DiaEspecialPD[]) {
    const p = new URLSearchParams();
    p.set("mes", String(mes0idx + 1));
    p.set("ano", String(ano));
    const df = feriados.map(f => f.dia).join(",");
    const dr = recessos.map(r => r.dia).join(",");
    if (df) p.set("feriados", df);
    if (dr) p.set("recessos", dr);
    const res = await fetch(`${BASE}api/documentos/prediario?${p}`, { credentials: "include" });
    if (!res.ok) throw new Error("Erro ao buscar dados");
    return res.json();
  }

  function filtrarPorTurmas(dados: any[]): any[] {
    if (turmasSel.size === 0) return dados;
    return dados.filter((b: any) => turmasSel.has(b.turma?.nome ?? b.turma));
  }

  async function gerarPreDiario() {
    setCarregando(true);
    setErro("");
    try {
      const nomeMes1 = `${MESES_NOME[mesSel].toUpperCase()} ${anoSel}`;
      const nomeMes2 = `${MESES_NOME[mesSel2].toUpperCase()} ${anoSel2}`;

      const raw1 = await buscarMes(mesSel, anoSel, m1.feriados, m1.recessos);
      const dados1 = filtrarPorTurmas(raw1);
      if (!dados1.length) { setErro("Nenhuma turma encontrada."); return; }

      let dadosFinal: any[];
      if (segundoMes) {
        const raw2   = await buscarMes(mesSel2, anoSel2, m2.feriados, m2.recessos);
        const dados2 = filtrarPorTurmas(raw2);
        dadosFinal = dados1.map((bloco1: any) => {
          const bloco2 = dados2.find((b: any) => b.turma.nome === bloco1.turma.nome) ?? { datasLetivas: [] };
          return {
            ...bloco1,
            grupos: [
              { nomeMes: nomeMes1, datas: bloco1.datasLetivas ?? [] },
              { nomeMes: nomeMes2, datas: bloco2.datasLetivas ?? [] },
            ],
          };
        });
      } else {
        dadosFinal = dados1.map((bloco: any) => ({
          ...bloco,
          grupos: [{ nomeMes: nomeMes1, datas: bloco.datasLetivas ?? [] }],
        }));
      }

      // Converte para estrutura de revisão (com ativo e tmpId)
      const revisao: BlocoRev[] = dadosFinal.map((bloco: any) => ({
        turma: bloco.turma,
        grupos: bloco.grupos,
        alunos: (bloco.alunos ?? []).map((a: any, i: number) => ({
          tmpId: `${bloco.turma?.nome ?? i}-${a.n}-${i}`,
          n: a.n,
          nome: a.nome,
          ativo: true,
        })),
      }));
      setDadosRevisao(revisao);
    } catch (e: any) {
      setErro(e.message || "Erro ao gerar pré-diário");
    } finally {
      setCarregando(false);
    }
  }

  function confirmarGerar() {
    if (!dadosRevisao) return;
    const dadosParaGerar = dadosRevisao.map(bloco => ({
      ...bloco,
      alunos: bloco.alunos
        .filter(a => a.ativo)
        .map((a, i) => ({ n: i + 1, nome: a.nome })),
    }));
    const html = gerarHtmlPreDiario(dadosParaGerar);
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    setDadosRevisao(null);
    setEditandoNome(null);
  }

  function exportarPdfPreDiario() {
    if (!dadosRevisao) return;
    const blocos = dadosRevisao.map(bloco => ({
      ...bloco,
      alunos: bloco.alunos.filter(a => a.ativo).map((a, i) => ({ n: i + 1, nome: a.nome })),
    }));
    const hoje = new Date().toLocaleDateString("pt-BR");
    const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw   = doc.internal.pageSize.getWidth();
    const mg   = 10;

    blocos.forEach((bloco, bi) => {
      if (bi > 0) doc.addPage();
      const turma = bloco.turma ?? {};
      const grupos: { nomeMes: string; datas: { data: string; aulas: number }[] }[] = bloco.grupos ?? [];

      doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES — SECRETARIA MUNICIPAL DE EDUCAÇÃO", mg, 8);
      doc.text("E. M. JOSÉ GIRÓ FAÍSCA — PRÉ-DIÁRIO DE CLASSE", mg, 12);
      doc.setFont("helvetica", "normal");
      const tituloMeses = grupos.map(g => g.nomeMes).filter(Boolean).join(" / ");
      const infos = [`TURMA: ${turma.nome ?? "—"}`, `TURNO: ${turma.turno ?? "—"}`, `PROFESSOR(A): ${turma.professor ?? "—"}`, `EMISSÃO: ${hoje}`];
      if (tituloMeses) infos.unshift(`PERÍODO: ${tituloMeses}`);
      doc.text(infos.join("     "), mg, 16);
      doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(mg, 18, pw - mg, 18);

      const todasDatas = grupos.flatMap(g => g.datas.map(d => ({ mes: g.nomeMes, data: d.data })));
      const colHeaders = ["Nº", "Nome do Aluno", ...todasDatas.map(d => d.data.split("/")[0] || d.data)];
      const body = bloco.alunos.map(a => [String(a.n), a.nome, ...todasDatas.map(() => "")]);

      autoTable(doc, {
        head: [colHeaders],
        body,
        startY: 21,
        margin: { left: mg, right: mg },
        styles: { fontSize: 6, cellPadding: 1.5, valign: "middle" },
        headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: "bold", fontSize: 6 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 55 },
          ...Object.fromEntries(todasDatas.map((_, i) => [i + 2, { cellWidth: 6, halign: "center" }])),
        },
        tableLineColor: 0, tableLineWidth: 0.1,
      });
    });

    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`Pre-Diario_${dataStr}.pdf`);
    setDadosRevisao(null);
    setEditandoNome(null);
  }

  function exportarExcelPreDiario() {
    if (!dadosRevisao) return;
    const blocos = dadosRevisao.map(bloco => ({
      ...bloco,
      alunos: bloco.alunos.filter(a => a.ativo).map((a, i) => ({ n: i + 1, nome: a.nome })),
    }));
    const hoje = new Date().toLocaleDateString("pt-BR");
    const wb   = XLSX.utils.book_new();

    blocos.forEach(bloco => {
      const turma = bloco.turma ?? {};
      const grupos: { nomeMes: string; datas: { data: string; aulas: number }[] }[] = bloco.grupos ?? [];
      const tituloMeses = grupos.map(g => g.nomeMes).filter(Boolean).join(" / ");
      const todasDatas  = grupos.flatMap(g => g.datas.map(d => d.data));

      const linhas: (string | number)[][] = [
        ["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"],
        ["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"],
        ["E. M. JOSÉ GIRÓ FAÍSCA — PRÉ-DIÁRIO DE CLASSE"],
        [`TURMA: ${turma.nome ?? "—"}     TURNO: ${turma.turno ?? "—"}     PROFESSOR(A): ${turma.professor ?? "—"}${tituloMeses ? "     PERÍODO: " + tituloMeses : ""}     EMISSÃO: ${hoje}`],
        [],
        ["Nº", "Nome do Aluno", ...todasDatas],
        ...bloco.alunos.map(a => [a.n, a.nome, ...todasDatas.map(() => "")]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 40 },
        ...todasDatas.map(() => ({ wch: 5 })),
      ];
      const nomePlan = (turma.nome ?? "Turma").slice(0, 31).replace(/[\\/?*[\]:]/g, "_");
      XLSX.utils.book_append_sheet(wb, ws, nomePlan);
    });

    const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Pre-Diario_${dataStr}.xlsx`);
    setDadosRevisao(null);
    setEditandoNome(null);
  }

  function toggleAlunoAtivo(blocoIdx: number, tmpId: string) {
    setDadosRevisao(prev => prev && prev.map((b, bi) =>
      bi !== blocoIdx ? b : {
        ...b,
        alunos: b.alunos.map(a => a.tmpId === tmpId ? { ...a, ativo: !a.ativo } : a),
      }
    ));
  }

  function editarNomeAluno(blocoIdx: number, tmpId: string, novoNome: string) {
    setDadosRevisao(prev => prev && prev.map((b, bi) =>
      bi !== blocoIdx ? b : {
        ...b,
        alunos: b.alunos.map(a => a.tmpId === tmpId ? { ...a, nome: novoNome } : a),
      }
    ));
  }

  function removerAluno(blocoIdx: number, tmpId: string) {
    setDadosRevisao(prev => prev && prev.map((b, bi) =>
      bi !== blocoIdx ? b : {
        ...b,
        alunos: b.alunos.filter(a => a.tmpId !== tmpId),
      }
    ));
  }

  function adicionarAluno(blocoIdx: number) {
    setDadosRevisao(prev => {
      if (!prev) return prev;
      const bloco = prev[blocoIdx];
      const novoN = bloco.alunos.length + 1;
      const tmpId = `extra-${blocoIdx}-${Date.now()}`;
      const novoAluno: AlunoRev = { tmpId, n: novoN, nome: "", ativo: true };
      const novo = prev.map((b, bi) =>
        bi !== blocoIdx ? b : { ...b, alunos: [...b.alunos, novoAluno] }
      );
      setEditandoNome(tmpId);
      return novo;
    });
  }

  const labelBotao = segundoMes
    ? `${MESES_NOME[mesSel]} + ${MESES_NOME[mesSel2]} ${anoSel}`
    : `${MESES_NOME[mesSel]} ${anoSel}`;

  const previewTotal = m1.previewCount + (segundoMes ? m2.previewCount : 0);

  // ── UI helpers ──────────────────────────────────────────────────────────────
  function SelectMes({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 text-white px-3 text-sm focus:outline-none focus:border-orange-500/50">
        {MESES_NOME.map((m, i) => <option key={i} value={i} style={{ background: "#1e293b" }}>{m}</option>)}
      </select>
    );
  }
  function SelectAno({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 text-white px-3 text-sm focus:outline-none focus:border-orange-500/50">
        {ANOS_DISP.map(a => <option key={a} value={a} style={{ background: "#1e293b" }}>{a}</option>)}
      </select>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Modal de revisão de alunos ── */}
      {dadosRevisao && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]/95 backdrop-blur-sm overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0f172a] border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Revisar alunos antes de imprimir</p>
                <p className="text-white/40 text-xs">Edite nomes, desmarque ou adicione alunos por turma</p>
              </div>
            </div>
            <button onClick={() => { setDadosRevisao(null); setEditandoNome(null); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>

          <div className="flex-1 px-6 py-5 space-y-6 max-w-3xl w-full mx-auto">
            {dadosRevisao.map((bloco, bi) => {
              const ativos = bloco.alunos.filter(a => a.ativo).length;
              return (
                <div key={bi} className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-300 text-sm">{bloco.turma?.nome ?? `Turma ${bi + 1}`}</span>
                      {bloco.turma?.turno && <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{bloco.turma.turno}</span>}
                    </div>
                    <span className="text-xs text-white/40">{ativos} aluno{ativos !== 1 ? "s" : ""} incluído{ativos !== 1 ? "s" : ""}</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {bloco.alunos.map((aluno, _ai) => (
                      <div key={aluno.tmpId}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${aluno.ativo ? "" : "opacity-40"}`}>
                        {/* Checkbox incluir/excluir */}
                        <button
                          onClick={() => toggleAlunoAtivo(bi, aluno.tmpId)}
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                            aluno.ativo
                              ? "bg-orange-500 border-orange-500"
                              : "bg-white/5 border-white/20 hover:border-white/40"
                          }`}>
                          {aluno.ativo && <Check className="h-3 w-3 text-white" />}
                        </button>

                        {/* Número */}
                        <span className="text-[11px] text-white/30 w-5 text-right shrink-0">{_ai + 1}</span>

                        {/* Nome editável */}
                        {editandoNome === aluno.tmpId ? (
                          <input
                            autoFocus
                            value={aluno.nome}
                            onChange={e => editarNomeAluno(bi, aluno.tmpId, e.target.value)}
                            onBlur={() => setEditandoNome(null)}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditandoNome(null); }}
                            className="flex-1 bg-white/10 border border-orange-500/50 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-orange-500"
                            placeholder="Nome do aluno"
                          />
                        ) : (
                          <span
                            className="flex-1 text-sm text-white/80 cursor-pointer hover:text-white transition-colors truncate"
                            onClick={() => setEditandoNome(aluno.tmpId)}>
                            {aluno.nome || <span className="text-white/30 italic">sem nome</span>}
                          </span>
                        )}

                        {/* Editar nome */}
                        <button
                          onClick={() => setEditandoNome(editandoNome === aluno.tmpId ? null : aluno.tmpId)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-orange-300 hover:bg-orange-500/10 transition-colors shrink-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {/* Remover */}
                        <button
                          onClick={() => removerAluno(bi, aluno.tmpId)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Adicionar aluno */}
                  <div className="px-4 py-3 border-t border-white/5">
                    <button
                      onClick={() => adicionarAluno(bi)}
                      className="flex items-center gap-2 text-xs text-orange-400/70 hover:text-orange-300 transition-colors">
                      <UserPlus className="h-3.5 w-3.5" />
                      Adicionar aluno
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer fixo */}
          <div className="sticky bottom-0 bg-[#0f172a] border-t border-white/10 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => { setDadosRevisao(null); setEditandoNome(null); }}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors px-4 py-2 rounded-xl border border-white/10 hover:border-white/20">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={confirmarGerar}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
                <FileText className="h-4 w-4" />
                Abrir / Imprimir
              </button>
              <button
                onClick={exportarPdfPreDiario}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
                <FileText className="h-4 w-4" />
                Baixar PDF
              </button>
              <button
                onClick={exportarExcelPreDiario}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
                <FileSpreadsheet className="h-4 w-4" />
                Baixar Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Configurações gerais ── */}
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="font-bold text-white">Pré-Diário de Classe</p>
            <p className="text-white/40 text-xs">Folha de presença para preenchimento manual pelos professores</p>
          </div>
        </div>

        {/* Turmas */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Turmas</Label>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
            {/* Caixinha "Todas" */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={turmas.length > 0 && turmasSel.size === turmas.length}
                onChange={() => {
                  if (turmasSel.size === turmas.length) {
                    setTurmasSel(new Set());
                  } else {
                    setTurmasSel(new Set(turmas.map((t: any) => t.nomeTurma)));
                  }
                }}
                className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
              />
              <span className="text-sm text-white/80 group-hover:text-white transition-colors font-medium">
                Todas as turmas
              </span>
              {turmasSel.size === turmas.length && turmas.length > 0 && (
                <span className="ml-auto text-[10px] text-orange-400/70 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  {turmas.length} turma{turmas.length !== 1 ? "s" : ""}
                </span>
              )}
            </label>

            {turmas.length > 0 && (
              <div className="border-t border-white/8 pt-2 grid grid-cols-2 gap-1">
                {turmas.map((t: any) => {
                  const nome = t.nomeTurma;
                  const sel  = turmasSel.has(nome);
                  return (
                    <label key={t.id || nome} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg hover:bg-white/5 transition-colors">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => {
                          setTurmasSel(prev => {
                            const next = new Set(prev);
                            if (sel) next.delete(nome); else next.add(nome);
                            return next;
                          });
                        }}
                        className="w-3.5 h-3.5 rounded accent-orange-500 cursor-pointer shrink-0"
                      />
                      <span className={`text-xs transition-colors leading-tight ${sel ? "text-orange-300 font-semibold" : "text-white/60 group-hover:text-white/80"}`}>
                        {nome}{t.turno ? <span className="text-white/30"> · {t.turno}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {turmasSel.size > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-white/8">
                <span className="text-[11px] text-orange-300/80">{turmasSel.size} turma{turmasSel.size !== 1 ? "s" : ""} selecionada{turmasSel.size !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => setTurmasSel(new Set())}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
                >limpar</button>
              </div>
            )}
          </div>
        </div>

        {/* Prévia */}
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <p className="text-orange-300 font-bold text-sm">~{previewTotal} colunas de dias letivos</p>
            <p className="text-white/40 text-xs">
              {MESES_NOME[mesSel]} {anoSel}{segundoMes ? ` + ${MESES_NOME[mesSel2]} ${anoSel2}` : ""}
              {" "}· fins de semana e dias especiais excluídos
            </p>
          </div>
        </div>
      </div>

      {/* ── Mês 1 ── */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          {segundoMes ? "1º Mês" : "Mês"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Mês</Label>
            <SelectMes value={mesSel} onChange={setMesSel} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Ano</Label>
            <SelectAno value={anoSel} onChange={setAnoSel} />
          </div>
        </div>
        <SecaoDiasEspeciaisPD titulo="Feriados e Pontos Facultativos" cor="red"
          diasNoMes={m1.diasNoMes} ano={anoSel} mes={mesSel}
          itens={m1.feriados} onAdd={m1.addFeriado} onRemove={m1.removeFeriado} onUpdate={m1.updateFeriado} />
        <SecaoDiasEspeciaisPD titulo="Recessos Escolares" cor="amber"
          diasNoMes={m1.diasNoMes} ano={anoSel} mes={mesSel}
          itens={m1.recessos} onAdd={m1.addRecesso} onRemove={m1.removeRecesso} onUpdate={m1.updateRecesso} />
      </div>

      {/* ── Toggle segundo mês ── */}
      <button
        onClick={() => setSegundoMes(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors
          ${segundoMes
            ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
            : "border-white/10 bg-white/3 text-white/50 hover:bg-white/8 hover:text-white/70"}`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4" />
          {segundoMes ? "Remover segundo mês" : "Incluir segundo mês no documento"}
        </span>
        <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5
          ${segundoMes ? "bg-orange-500" : "bg-white/20"}`}>
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform
            ${segundoMes ? "translate-x-5" : "translate-x-0"}`} />
        </div>
      </button>

      {/* ── Mês 2 (condicional) ── */}
      {segundoMes && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/3 p-5 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-orange-400/70 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />2º Mês
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Mês</Label>
              <SelectMes value={mesSel2} onChange={setMesSel2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Ano</Label>
              <SelectAno value={anoSel2} onChange={setAnoSel2} />
            </div>
          </div>
          <SecaoDiasEspeciaisPD titulo="Feriados e Pontos Facultativos" cor="red"
            diasNoMes={m2.diasNoMes} ano={anoSel2} mes={mesSel2}
            itens={m2.feriados} onAdd={m2.addFeriado} onRemove={m2.removeFeriado} onUpdate={m2.updateFeriado} />
          <SecaoDiasEspeciaisPD titulo="Recessos Escolares" cor="amber"
            diasNoMes={m2.diasNoMes} ano={anoSel2} mes={mesSel2}
            itens={m2.recessos} onAdd={m2.addRecesso} onRemove={m2.removeRecesso} onUpdate={m2.updateRecesso} />
        </div>
      )}

      {/* Observações */}
      <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs text-white/50 space-y-1">
        <p>• Os feriados nacionais de cada mês são carregados automaticamente.</p>
        <p>• Com dois meses: o documento terá uma faixa azul separando cada mês na tabela.</p>
        <p>• O documento é gerado em formato A4 Paisagem — ideal para impressão.</p>
      </div>

      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      <Button onClick={gerarPreDiario} disabled={carregando}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-xl">
        {carregando ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando pré-diário...</>
        ) : (
          <><FileText className="h-4 w-4 mr-2" />Gerar Pré-Diário — {labelBotao}</>
        )}
      </Button>
    </div>
  );
}

// ─── Seção: Em Breve ─────────────────────────────────────────────────────────
function SecaoEmBreve({ titulo, cor, descricao }: { titulo: string; cor: string; descricao?: string }) {
  const corMap: Record<string, { bg: string; text: string; border: string }> = {
    violet:  { bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    cyan:    { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/20" },
  };
  const c = corMap[cor] ?? corMap.violet;
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-12 text-center`}>
      <div className="text-5xl mb-4">📄</div>
      <h3 className={`text-xl font-bold ${c.text} mb-2`}>{titulo}</h3>
      <p className="text-white/40 text-sm max-w-sm mx-auto">
        {descricao || `Esta seção está sendo preparada. Em breve você poderá gerar documentos de ${titulo.toLowerCase()}.`}
      </p>
      <p className="text-white/20 text-xs mt-4">Novos documentos serão adicionados conforme a necessidade.</p>
    </div>
  );
}

// ─── Hub ──────────────────────────────────────────────────────────────────────
type SecaoId = "declaracoes" | "infantil" | "fundamental" | "ponto" | "prediario";

const SECOES: { id: SecaoId; label: string; descricao: string; icone: any; cor: string; badge?: string }[] = [
  { id: "declaracoes",  label: "Declarações",                   descricao: "Gere declarações preenchidas automaticamente",                      icone: FileText,      cor: "blue" },
  { id: "prediario",    label: "Pré-Diário de Classe",          descricao: "Folha de presença para os professores marcarem manualmente",        icone: ClipboardList, cor: "orange" },
  { id: "infantil",     label: "Documentos Ensino Infantil",    descricao: "Documentos específicos da Educação Infantil",                       icone: Baby,          cor: "violet",  badge: "Em breve" },
  { id: "fundamental",  label: "Documentos Ensino Fundamental", descricao: "Documentos específicos do Ensino Fundamental",                      icone: BookOpen,      cor: "emerald", badge: "Em breve" },
  { id: "ponto",        label: "Ponto dos Funcionários",        descricao: "Registro e controle de ponto da equipe escolar",                    icone: ClipboardList, cor: "cyan",    badge: "Em breve" },
];

const COR_CARD: Record<string, { bg: string; border: string; text: string; icon: string; hover: string }> = {
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-400",    icon: "bg-blue-500/20",    hover: "hover:border-blue-500/50" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-400",  icon: "bg-violet-500/20",  hover: "hover:border-violet-500/50" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "bg-emerald-500/20", hover: "hover:border-emerald-500/50" },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-400",    icon: "bg-cyan-500/20",    hover: "hover:border-cyan-500/50" },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-400",  icon: "bg-orange-500/20",  hover: "hover:border-orange-500/50" },
};

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DocumentosPage() {
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoId | null>(null);
  const [, navigate] = useLocation();
  const secaoInfo = SECOES.find(s => s.id === secaoAtiva);

  function handleCardClick(id: SecaoId) {
    if (id === "ponto") { navigate("/ponto"); return; }
    setSecaoAtiva(id);
  }

  return (
    <AppLayout>
      <div className="space-y-8 pb-10">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          {secaoAtiva && (
            <button
              onClick={() => setSecaoAtiva(null)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors shrink-0"
            >
              <ChevronLeft className="h-5 w-5 text-white/70" />
            </button>
          )}
          <div>
            <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
              {secaoAtiva ? secaoInfo?.label : "Documentos"}
            </h1>
            <p className="text-white/40 text-sm mt-0.5">
              {secaoAtiva ? secaoInfo?.descricao : "Selecione uma categoria"}
            </p>
          </div>
        </div>

        {/* Hub */}
        {!secaoAtiva && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SECOES.map(s => {
              const c = COR_CARD[s.cor];
              const Icone = s.icone;
              return (
                <button
                  key={s.id}
                  onClick={() => handleCardClick(s.id)}
                  className={`flex items-center gap-4 p-5 rounded-2xl border ${c.bg} ${c.border} ${c.hover} transition-all duration-200 hover:scale-[1.02] text-left group`}
                >
                  <div className={`w-14 h-14 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>
                    <Icone className={`h-7 w-7 ${c.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-base">{s.label}</p>
                      {s.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
                          {s.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{s.descricao}</p>
                  </div>
                  <ChevronRight className={`h-5 w-5 ${c.text} opacity-40 group-hover:opacity-80 transition-opacity shrink-0`} />
                </button>
              );
            })}
          </div>
        )}

        {/* Conteúdo da seção */}
        {secaoAtiva === "declaracoes"  && <SecaoDeclaracoes />}
        {secaoAtiva === "prediario"   && <SecaoPreDiario />}
        {secaoAtiva === "infantil"     && <SecaoEmBreve titulo="Documentos Ensino Infantil"    cor="violet"  />}
        {secaoAtiva === "fundamental"  && <SecaoEmBreve titulo="Documentos Ensino Fundamental" cor="emerald" />}
      </div>
    </AppLayout>
  );
}

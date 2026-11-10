// @ts-nocheck
/**
 * Parser de Diário e Boletim SUAP — PDF
 *
 * Estrutura do PDF de Diário (/edu/diario_pdf/{id}/0/):
 *  • Cabeçalho: Curso, Diário, Bimestre, Turma (código entre parênteses), Professores
 *  • Tabela de presenças: linha "Dia" + números dos dias, linha "Mês" + meses,
 *    linha "N.A." (pular), linhas de alunos com - (presença) ou 1..4 (falta)
 *  • Seção "REGISTRO DE ATIVIDADES": data + nº aulas + conteúdo
 *  • Assinatura: nome + "(Professor Regente)"
 *
 * Estrutura do PDF de Boletim (/edu/emitir_boletins_pdf/{id}/):
 *  • Cabeçalho: BOLETIM DE NOTAS DO DIÁRIO, Curso, Diário, Turma, Aulas Ministradas
 *  • Linhas de alunos com T. Faltas, % Freq., e pares (N, F) para Bim. 1..4 + MD/MFD
 */

// Importa a lib interna para evitar o teste que pdf-parse executa no carregamento
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface AlunoFrequencia {
  matricula: string;
  nome: string;
  frequencias: { data: string; status: "P" | "F" }[];
  totalFaltasPDF: number;
  nota: number | null;
}

export interface AtividadeDiario {
  data: string;   // YYYY-MM-DD
  numAulas: number;
  conteudo: string;
}

export interface SecaoDiario {
  turmaCodigo: string;   // ex: "1AM01"
  turmaLocal: string;    // ex: "1AM01"
  disciplina: string;    // ex: "1º Ano - Fundamental"
  bimestre: number;
  ano: number;
  professorRegente: string;
  alunos: AlunoFrequencia[];
  atividades: AtividadeDiario[];
}

export interface DiarioParsed {
  secoes: SecaoDiario[];
  erros: string[];
}

export interface AlunoBoletimBimestre {
  bimestre: number;
  nota: number | null;
  faltas: number;
}

export interface AlunoBoletim {
  matricula: string;
  nome: string;
  totalFaltas: number;
  percentualFrequencia: number;
  bimestres: AlunoBoletimBimestre[];
  mediaFinal: number | null;
}

export interface BoletimParsed {
  turmaCodigo: string;
  turmaLocal: string;
  disciplina: string;
  ano: number;
  aulasMinistradas: number;
  aulasPrevistas: number;
  alunos: AlunoBoletim[];
  erros: string[];
}

/* ─── Normalização ─────────────────────────────────────────────── */

export function normalizarTurmaLocal(codigo: string): string {
  const c = String(codigo || "").trim().toUpperCase();
  const TURMAS_OFICIAIS = [
    "1AM01", "1AT02", "2AM01", "2AT02", "3AM01", "4AM01", "5AT01",
    "G2T01", "G3M01", "NIT01", "P1M01", "P1T02", "P2M01", "P2T02"
  ];

  for (const t of TURMAS_OFICIAIS) {
    if (c.includes(t)) return t;
  }

  if (/\bNI\b|INCLUS[AÃ]O/i.test(c)) {
    return "NIT01";
  }

  const m = c.match(/^(\d+)[A-Za-z]+(\d{2})$/);
  if (!m) return codigo;
  const anoNum = m[1];
  const seq = parseInt(m[2], 10);
  const letra = String.fromCharCode(64 + seq);
  return `${anoNum}${letra}`;
}

function normNome(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extrairDisciplinaLimpa(raw: string): string {
  if (!raw) return "Regente / Globalizado";
  const semColchetes = raw.replace(/\[.*?\]/g, "").trim();
  const partes = semColchetes.split(" - ").map((p) => p.trim()).filter(Boolean);
  // Ex: "56202 - FUND.0148 - 1º Ano - Fundamental - Anos / Fases Iniciais"
  if (partes.length >= 3 && /^\d+$/.test(partes[0])) {
    return partes.slice(2, 4).join(" - ") || partes[2];
  }
  return partes[0] || "Regente / Globalizado";
}

/* ─── Parser principal do Diário PDF ───────────────────────────── */

export async function parseDiarioPDF(buffer: Buffer): Promise<DiarioParsed> {
  const data = await pdfParse(buffer);
  return parseDiarioTexto(data.text as string);
}

export function parseDiarioTexto(texto: string): DiarioParsed {
  const linhas = texto.split("\n").map((l) => l.trimEnd());
  const secoes: SecaoDiario[] = [];
  const erros: string[] = [];

  // Cada seção começa em uma linha que contém "Curso:"
  const inicios: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s*Curso:\s*$/.test(linhas[i]) || /^\s*Curso:\s+\S/.test(linhas[i])) {
      inicios.push(i);
    }
  }

  // Fallback
  if (inicios.length === 0) {
    for (let i = 0; i < linhas.length; i++) {
      if (/Ensino Fundamental|Educação Infantil/i.test(linhas[i])) inicios.push(i);
    }
  }

  if (inicios.length === 0) {
    erros.push("Cabeçalho do diário não encontrado. Verifique se o PDF é de um diário SUAP.");
    return { secoes, erros };
  }

  for (let si = 0; si < inicios.length; si++) {
    const start = inicios[si];
    const end = si + 1 < inicios.length ? inicios[si + 1] : linhas.length;
    const bloco = linhas.slice(start, end);
    try {
      const s = parseSecao(bloco, erros);
      if (s && (s.alunos.length > 0 || s.atividades.length > 0)) {
        secoes.push(s);
      }
    } catch (e: any) {
      erros.push(`Seção ${si + 1}: ${e.message}`);
    }
  }

  return { secoes, erros };
}

/* ─── Seção individual ─────────────────────────────────────────── */

function parseSecao(linhas: string[], erros: string[]): SecaoDiario | null {
  let turmaCodigo = "";
  let bimestre = 1;
  let ano = new Date().getFullYear();
  let professorRegente = "";
  let disciplina = "";

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;

    // Capturar Bimestre (inline "Bimestre: 2" ou na linha seguinte "Bimestre:\n2")
    if (/^Bimestre:/i.test(l)) {
      const mBim = l.match(/Bimestre:\s*(\d)/i);
      if (mBim) {
        bimestre = parseInt(mBim[1], 10);
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        if (/^[1-4]$/.test(prox)) {
          bimestre = parseInt(prox, 10);
        }
      }
    }

    // Capturar Ano/Período (ex: "2026/1")
    if (/^Ano\/Per[ií]odo/i.test(l)) {
      const mAno = l.match(/(\d{4})/);
      if (mAno) {
        ano = parseInt(mAno[1], 10);
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        const mProxAno = prox.match(/(\d{4})/);
        if (mProxAno) ano = parseInt(mProxAno[1], 10);
      }
    }

    // Tenta extrair a partir de "Turma:" no cabeçalho
    if (/^Turma:/i.test(l)) {
      const mParenInline = l.match(/\(([^)]+)\)/);
      const mInline = l.match(/Turma:\s*\(?([A-Z0-9]{4,7})\)?$/i);
      if (mParenInline) {
        turmaCodigo = mParenInline[1].trim();
      } else if (mInline) {
        turmaCodigo = mInline[1].trim();
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        const mProx = prox.match(/\(([^)]+)\)/) || prox.match(/\(?([A-Z0-9]{4,7})\)?$/i);
        if (mProx) {
          turmaCodigo = mProx[1].trim();
        }
      }
    }

    // Tenta extrair a disciplina a partir de "Diário:"
    if (/^Di[áa]rio:/i.test(l)) {
      const m = l.match(/Di[áa]rio:\s*(.+)/i);
      if (m && m[1].trim()) {
        disciplina = extrairDisciplinaLimpa(m[1].trim());
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        if (prox) {
          disciplina = extrairDisciplinaLimpa(prox);
        }
      }
    }

    // Professor Regente
    if (/\(\s*Professor\s+Regente\s*\)/i.test(l)) {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const prev = linhas[j].trim();
        if (prev && !/^\(/.test(prev) && !/^Profes/i.test(prev) && !/Campos dos Goytacazes/i.test(prev)) {
          professorRegente = prev;
          break;
        }
      }
    }
  }

  if (!turmaCodigo) {
    erros.push("Código de turma não encontrado (esperado: 'XXXXXX (código)')");
    return null;
  }

  const alunos = parsePresencas(linhas, ano, erros);
  const atividades = parseAtividades(linhas, ano);

  return {
    turmaCodigo,
    turmaLocal: normalizarTurmaLocal(turmaCodigo),
    disciplina: disciplina || "Regente / Globalizado",
    bimestre,
    ano,
    professorRegente,
    alunos,
    atividades,
  };
}

/* ─── Tabela de presenças ──────────────────────────────────────── */

function parseLinhaAlunoFrequencia(
  matricula: string,
  nomeEFreq: string,
  datas: string[]
): AlunoFrequencia | null {
  const numDias = datas.length;
  // Separar nome do bloco de frequências/notas
  const m = nomeEFreq.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]+?)\s+([-\.·0-9Ff\s]+)$/);
  if (!m) return null;

  const nome = m[1].trim();
  const tailSemEspacos = m[2].replace(/\s+/g, "");
  if (tailSemEspacos.length < numDias) return null;

  const freqStr = tailSemEspacos.substring(0, numDias);
  const restoSemEspacos = tailSemEspacos.substring(numDias);

  let faltasContadas = 0;
  const frequencias = datas.map((data, idx) => {
    const char = freqStr[idx] ?? "-";
    const isFalta = char === "1" || char === "2" || char === "3" || char === "4" || char === "F" || char === "f";
    if (isFalta) {
      const peso = /[1-4]/.test(char) ? parseInt(char, 10) : 1;
      faltasContadas += peso;
    }
    const status: "P" | "F" = isFalta ? "F" : "P";
    return { data, status };
  });

  // Extrair nota e totalFaltasPDF do sufixo restoSemEspacos
  let totalFaltasPDF = faltasContadas;
  let nota: number | null = null;

  const faltasStr = String(faltasContadas);
  if (restoSemEspacos.endsWith(faltasStr)) {
    const notaPart = restoSemEspacos.slice(0, restoSemEspacos.length - faltasStr.length).replace(/-/g, "").trim();
    if (notaPart && /^\d+$/.test(notaPart)) {
      const nVal = Number(notaPart);
      nota = nVal > 10 ? nVal / 10 : nVal;
    }
  } else {
    const nums = m[2].substring(0).trim().match(/\d+/g);
    if (nums && nums.length >= 2) {
      const nVal = Number(nums[nums.length - 2]);
      nota = nVal > 10 ? nVal / 10 : nVal;
    }
  }

  return {
    matricula,
    nome: normNome(nome),
    frequencias,
    totalFaltasPDF,
    nota,
  };
}

function parsePresencas(
  linhas: string[],
  ano: number,
  erros: string[]
): AlunoFrequencia[] {
  // 1. Encontrar a linha "Dia"
  let diaIdx = -1;
  let diasStr = "";
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].replace(/\s+/g, "");
    const m = l.match(/^Dia(\d{2,})/i);
    if (m) {
      diaIdx = i;
      diasStr = m[1];
      break;
    }
    if (/^Dia/i.test(linhas[i]) && (linhas[i].match(/\b\d{1,2}\b/g) ?? []).length > 0) {
      diaIdx = i;
      break;
    }
  }
  if (diaIdx === -1) return [];

  let dias: number[] = [];
  if (diasStr) {
    for (let k = 0; k < diasStr.length; k += 2) {
      dias.push(Number(diasStr.substring(k, k + 2)));
    }
  } else {
    dias = (linhas[diaIdx].match(/\b(\d{1,2})\b/g) ?? []).map(Number);
  }
  if (dias.length === 0) return [];

  // 2. Encontrar a linha "Mês"
  let mesIdx = -1;
  let mesesStr = "";
  let meses: number[] = [];

  for (let i = diaIdx + 1; i < Math.min(diaIdx + 5, linhas.length); i++) {
    const l = linhas[i].replace(/\s+/g, "");
    const m = l.match(/M[eê]s(\d{2,})/i);
    if (m) {
      mesIdx = i;
      mesesStr = m[1];
      break;
    }
    if (/\bM[eê]s\b/i.test(linhas[i])) {
      const nums = (linhas[i].match(/\b(0?[1-9]|1[0-2])\b/g) ?? []).map(Number);
      if (nums.length > 0) {
        meses = nums;
        mesIdx = i;
        break;
      }
    }
  }

  if (mesesStr) {
    for (let k = 0; k < mesesStr.length; k += 2) {
      meses.push(Number(mesesStr.substring(k, k + 2)));
    }
  }

  if (meses.length === 0) {
    for (let i = diaIdx; i < Math.min(diaIdx + 5, linhas.length); i++) {
      const l = linhas[i].replace(/\s+/g, "");
      const m = l.match(/(\d{2})/g);
      if (m && m.length >= dias.length) {
        meses = m.map(Number);
        break;
      }
    }
  }

  // 3. Construir datas: parear dia[i] com mes[i]
  const datas: string[] = dias.map((d, i) => {
    const mes = meses[i] ?? meses[meses.length - 1] ?? 1;
    return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  // 4. Encontrar início dos alunos
  let alunoStart = (mesIdx !== -1 ? mesIdx : diaIdx) + 1;
  while (alunoStart < linhas.length && /N\.A\./i.test(linhas[alunoStart])) {
    alunoStart++;
  }

  const alunos: AlunoFrequencia[] = [];
  let i = alunoStart;

  while (i < linhas.length) {
    const l = linhas[i].trim();
    if (!l) {
      i++;
      continue;
    }

    if (/REGISTRO DE ATIVIDADES/i.test(l)) {
      break;
    }

    // Caso 1: Layout quebrado em 3 linhas (#, Matrícula, Nome + Frequências)
    if (/^\d{1,2}$/.test(l) && i + 2 < linhas.length && /^\d{10,16}$/.test(linhas[i + 1].trim())) {
      const matricula = linhas[i + 1].trim();
      const nomeEFreq = linhas[i + 2].trim();
      const parsed = parseLinhaAlunoFrequencia(matricula, nomeEFreq, datas);
      if (parsed) alunos.push(parsed);
      i += 3;
      continue;
    }

    // Caso 2: Layout em 1 linha
    const m1Linha = l.match(/^\s*(\d{1,2})\s*(\d{10,16})\s*(.+)$/);
    if (m1Linha) {
      const matricula = m1Linha[2].trim();
      const restoLinha = m1Linha[3].trim();
      const parsed = parseLinhaAlunoFrequencia(matricula, restoLinha, datas);
      if (parsed) alunos.push(parsed);
    }

    i++;
  }

  return alunos;
}

/* ─── Registro de atividades ───────────────────────────────────── */

function parseAtividades(linhas: string[], _ano: number): AtividadeDiario[] {
  const atividades: AtividadeDiario[] = [];
  // Suporta tanto "04/02/2026 1 Conteúdo" quanto "04/02/20261" (sem espaço antes/depois do nº de aulas)
  const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})\s*(\d+)\s*(.*)$/;
  let emRegistro = false;
  let atualIdx = -1;

  const IGNORAR_LINHA = /^(?:PREFEITURA MUNICIPAL|Escola Municipal|Rua São José|CNPJ:|Página\s+\d|Data\s*$|Nº\s*$|Aulas\s*$|Conteúdo\s*$|DataNº AulasConteúdo|Campos dos Goytacazes|\(Professor)/i;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;

    if (/REGISTRO DE ATIVIDADES/i.test(l)) {
      emRegistro = true;
      continue;
    }
    if (!emRegistro) continue;

    // Parar se chegou na assinatura de encerramento do bloco
    if (/^Campos dos Goytacazes/i.test(l) || /\(Professor\s+Regente\)/i.test(l)) {
      atualIdx = -1;
      continue;
    }

    if (IGNORAR_LINHA.test(l)) {
      continue;
    }

    const m = l.match(dataRegex);
    if (m) {
      const [, dd, mm, aaaa, na, conteudo] = m;
      atividades.push({
        data: `${aaaa}-${mm}-${dd}`,
        numAulas: parseInt(na, 10) || 1,
        conteudo: conteudo.trim(),
      });
      atualIdx = atividades.length - 1;
      continue;
    }

    if (atualIdx >= 0) {
      if (atividades[atualIdx].conteudo) {
        atividades[atualIdx].conteudo += "\n" + l;
      } else {
        atividades[atualIdx].conteudo = l;
      }
    }
  }

  return atividades;
}

/* ─── Parser do Boletim de Notas e Faltas do Diário (/edu/emitir_boletins_pdf/{id}/) ─── */

export async function parseBoletimPDF(buffer: Buffer): Promise<BoletimParsed> {
  const data = await pdfParse(buffer);
  return parseBoletimTexto(data.text as string);
}

export function parseBoletimTexto(texto: string): BoletimParsed {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const erros: string[] = [];
  let turmaCodigo = "";
  let disciplina = "Regente / Globalizado";
  let ano = new Date().getFullYear();
  let aulasMinistradas = 200;
  let aulasPrevistas = 200;

  for (const l of linhas) {
    if (/^Turma:/i.test(l)) {
      const mParen = l.match(/\(([^)]+)\)/);
      if (mParen) turmaCodigo = mParen[1].trim();
    }
    if (/^Di[áa]rio:/i.test(l)) {
      const m = l.match(/Di[áa]rio:\s*(.+)/i);
      if (m) disciplina = extrairDisciplinaLimpa(m[1]);
    }
    if (/Ano\/Per[ií]odo Letivo:/i.test(l)) {
      const mAno = l.match(/(\d{4})/);
      if (mAno) ano = parseInt(mAno[1], 10);
      const mAulas = l.match(/Aulas Ministradas:\s*(\d+)\s*de\s*(\d+)/i);
      if (mAulas) {
        aulasMinistradas = parseInt(mAulas[1], 10);
        aulasPrevistas = parseInt(mAulas[2], 10);
      }
    }
  }

  const alunos: AlunoBoletim[] = [];
  const vistos = new Set<string>();

  for (const l of linhas) {
    // Exemplo: "1   20231031610004AGATHA DE OLIVEIRA LUQUETTI1890%68  7  54  3  72  7   -   1  49-49"
    // Exemplo: "1020261021610059Heitor Gabriel da Silva Gomes7357%1008  10025  10025  -  15  75--"
    const m = l.match(/^\d{1,2}\s*(\d{12,16})\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]+?)(\d+)%\s*(.+)$/);
    if (!m) continue;

    const matricula = m[1].trim();
    if (vistos.has(matricula)) continue;
    vistos.add(matricula);

    const nome = m[2].trim();
    const digitsBeforePct = m[3];
    const resto = m[4].trim();

    let percentualFrequencia = 100;
    let totalFaltas = 0;

    if (digitsBeforePct.endsWith("100")) {
      percentualFrequencia = 100;
      totalFaltas = Number(digitsBeforePct.slice(0, -3) || "0");
    } else if (digitsBeforePct.length >= 2) {
      percentualFrequencia = Number(digitsBeforePct.slice(-2));
      totalFaltas = Number(digitsBeforePct.slice(0, -2) || "0");
    } else {
      percentualFrequencia = Number(digitsBeforePct);
      totalFaltas = 0;
    }

    // Normalizar tokens de notas e faltas quando "100" vem colado nas faltas (ex: "10016" -> "100 16")
    const normResto = resto
      .replace(/100(\d+)/g, "100 $1 ")
      .replace(/(\d)-/g, "$1 - ")
      .replace(/-(\d)/g, " - $1")
      .replace(/--+/g, " - - ")
      .trim();

    const tokens = normResto.split(/\s+/).filter(Boolean);
    const bimestres: AlunoBoletimBimestre[] = [];

    for (let b = 1; b <= 4; b++) {
      const nTok = tokens[(b - 1) * 2] ?? "-";
      const fTok = tokens[(b - 1) * 2 + 1] ?? "0";

      let nota: number | null = null;
      if (nTok !== "-" && /^\d+(\.\d+)?$/.test(nTok)) {
        const nVal = Number(nTok);
        nota = nVal > 10 ? nVal / 10 : nVal;
      }
      const faltas = /^\d+$/.test(fTok) ? Number(fTok) : 0;
      bimestres.push({ bimestre: b, nota, faltas });
    }

    let mediaFinal: number | null = null;
    const mdTok = tokens[8];
    const mfdTok = tokens[10];
    const mTok = mfdTok && mfdTok !== "-" ? mfdTok : mdTok;
    if (mTok && mTok !== "-" && /^\d+(\.\d+)?$/.test(mTok)) {
      const mVal = Number(mTok);
      mediaFinal = mVal > 10 ? mVal / 10 : mVal;
    }

    alunos.push({
      matricula,
      nome: normNome(nome),
      totalFaltas,
      percentualFrequencia,
      bimestres,
      mediaFinal,
    });
  }

  return {
    turmaCodigo,
    turmaLocal: normalizarTurmaLocal(turmaCodigo),
    disciplina,
    ano,
    aulasMinistradas,
    aulasPrevistas,
    alunos,
    erros,
  };
}

export { normNome };

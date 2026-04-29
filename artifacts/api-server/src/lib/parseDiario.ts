/**
 * Parser de Diário SUAP — PDF
 *
 * Estrutura do PDF:
 *  • Cabeçalho: Curso, Diário, Bimestre, Turma (código entre parênteses), Professores
 *  • Tabela de presenças: linha "Dia" + números dos dias, linha "Mês" + meses,
 *    linha "N.A." (pular), linhas de alunos com - (presença) ou 1 (falta)
 *  • Seção "REGISTRO DE ATIVIDADES": data + nº aulas + conteúdo
 *  • Assinatura: nome + "(Professor Regente)"
 *
 * Um mesmo PDF pode conter múltiplas seções (uma por mês/bimestre).
 */

// Importa a lib interna para evitar o teste que pdf-parse executa no carregamento
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export interface AlunoFrequencia {
  matricula: string;
  nome: string;
  frequencias: { data: string; status: "P" | "F" }[];
  totalFaltasPDF: number;
}

export interface AtividadeDiario {
  data: string;   // YYYY-MM-DD
  numAulas: number;
  conteudo: string;
}

export interface SecaoDiario {
  turmaCodigo: string;   // ex: "1AM01"
  turmaLocal: string;    // ex: "1A"
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

/* ─── Normalização ─────────────────────────────────────────────── */

/**
 * "1AM01" → "1A"   "6AT02" → "6B"   "3M01" → "3A"
 * Extrai o ano (dígitos iniciais) e converte a sequência 01→A, 02→B...
 */
function normalizarTurmaLocal(codigo: string): string {
  const m = codigo.match(/^(\d+)[A-Za-z]+(\d{2})$/);
  if (!m) return codigo;
  const anoNum = m[1];
  const seq = parseInt(m[2], 10);
  const letra = String.fromCharCode(64 + seq); // 1→A, 2→B, 3→C...
  return `${anoNum}${letra}`;
}

function normNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* ─── Parser principal ─────────────────────────────────────────── */

export async function parseDiarioPDF(buffer: Buffer): Promise<DiarioParsed> {
  const data = await pdfParse(buffer);
  return parseDiarioTexto(data.text as string);
}

export function parseDiarioTexto(texto: string): DiarioParsed {
  const linhas = texto.split("\n").map((l) => l.trimEnd());
  const secoes: SecaoDiario[] = [];
  const erros: string[] = [];

  // Cada seção começa em uma linha que contém apenas "Curso:" (possivelmente com espaços)
  const inicios: number[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s*Curso:\s*$/.test(linhas[i]) || /^\s*Curso:\s+\S/.test(linhas[i])) {
      inicios.push(i);
    }
  }

  // Fallback: se não encontrar "Curso:" tenta partir por "Ensino Fundamental"
  if (inicios.length === 0) {
    for (let i = 0; i < linhas.length; i++) {
      if (/Ensino Fundamental/.test(linhas[i])) inicios.push(i);
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
      if (s && s.alunos.length > 0) secoes.push(s);
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

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];

    // Código de turma: "20261.1.03161.1M (1AM01)"
    const mTurma = l.match(/\d{4,}\.\d+\.\d+\.\w+\s+\((\w+)\)/);
    if (mTurma) turmaCodigo = mTurma[1];

    // Ano letivo: "2026/1"
    const mAno = l.match(/\b(20\d{2})\/\d/);
    if (mAno) ano = parseInt(mAno[1]);

    // Bimestre: número isolado no final da linha do diário
    // Ex: "56202 - FUND.0148 - 1º Ano - ...   1"
    if (/\d+ - FUND\.\d+/.test(l)) {
      const mBim = l.match(/\b([1-4])\s*$/);
      if (mBim) bimestre = parseInt(mBim[1]);
    }

    // Professor Regente: aparece antes de "(Professor Regente)" na seção de assinatura
    if (/\(\s*Professor\s+Regente\s*\)/i.test(l)) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = linhas[j].trim();
        if (prev && !/^\(/.test(prev) && !/^Profes/i.test(prev)) {
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
    bimestre,
    ano,
    professorRegente,
    alunos,
    atividades,
  };
}

/* ─── Tabela de presenças ──────────────────────────────────────── */

function parsePresencas(
  linhas: string[],
  ano: number,
  erros: string[]
): AlunoFrequencia[] {
  /*
   * Estrutura da tabela:
   *   Linha "Dia":  "...Dia   04  05  06  09..."
   *   Linha "Mês":  "#  Matrícula  Aluno  Mês  02  02  02  02...  Nota  Faltas"
   *   Linha "N.A.": "...N.A.  1  1  1  1..."   ← pular
   *   Linhas alunos:"  1  20261031610002  Nome ...  -  -  1  -  ...  0"
   */

  // 1. Encontrar índice da linha "Dia"
  let diaIdx = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (/\bDia\b/.test(linhas[i]) && /\d{1,2}\s+\d{1,2}/.test(linhas[i])) {
      diaIdx = i;
      break;
    }
  }
  if (diaIdx === -1) return [];

  // 2. Extrair dias da linha "Dia"
  const dias = (linhas[diaIdx].match(/\b(\d{1,2})\b/g) ?? []).map(Number);
  if (dias.length === 0) return [];

  // 3. Linha "Mês" — é a linha com "Mês" E números de mês (normalmente logo abaixo)
  let mesIdx = diaIdx + 1;
  let meses: number[] = [];
  for (let i = diaIdx + 1; i < Math.min(diaIdx + 4, linhas.length); i++) {
    if (/\bM[eê]s\b/i.test(linhas[i])) {
      // Pega todos os números que parecem mês (01-12)
      const nums = (linhas[i].match(/\b(0?[1-9]|1[0-2])\b/g) ?? []).map(Number);
      if (nums.length > 0) { meses = nums; mesIdx = i; break; }
    }
  }

  // Se não encontrou linha de mês, tenta usar apenas o primeiro mês que aparecer perto
  if (meses.length === 0) {
    for (let i = diaIdx; i < Math.min(diaIdx + 5, linhas.length); i++) {
      const nums = (linhas[i].match(/\b(0?[1-9]|1[0-2])\b/g) ?? []).map(Number);
      if (nums.length >= dias.length / 2) { meses = nums; break; }
    }
  }

  // 4. Construir datas: parear dia[i] com mes[i], preenchendo o último mês se necessário
  const datas: string[] = dias.map((d, i) => {
    const mes = (meses[i] ?? meses[meses.length - 1] ?? 1);
    const anoFinal = ano;
    return `${anoFinal}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });

  // 5. Pular linha N.A. e encontrar início dos alunos
  // Linhas de aluno: começam com espaços + número + espaços + matrícula (12+ dígitos)
  const alunoRegex = /^\s+(\d+)\s+(\d{10,})\s+(.+)/;
  const alunos: AlunoFrequencia[] = [];

  // A linha N.A. é depois de mesIdx, pular ela
  let alunoStart = mesIdx + 1;
  while (alunoStart < linhas.length && /N\.A\./i.test(linhas[alunoStart])) {
    alunoStart++;
  }

  for (let i = alunoStart; i < linhas.length; i++) {
    const l = linhas[i];
    const m = l.match(alunoRegex);
    if (!m) continue;

    const matricula = m[2];
    const resto = m[3];

    // Tokenizar o resto: nome + presencas + faltas
    const tokens = resto.trim().split(/\s+/);

    // Presença = "." ou "-"  |  Falta = "1"
    const isPresenca = (t: string) => t === "." || t === "-" || t === "·";
    const isFalta    = (t: string) => t === "1";
    const isAtt      = (t: string) => isPresenca(t) || isFalta(t);

    // Encontrar primeiro token de presença/falta
    let attStart = -1;
    for (let t = 0; t < tokens.length; t++) {
      if (isAtt(tokens[t])) { attStart = t; break; }
    }

    if (attStart === -1) continue;

    const nomeParts = tokens.slice(0, attStart);
    const nome = nomeParts.join(" ").trim();
    const attTokens = tokens.slice(attStart);

    // Separar attendance de faltas: attendance são ".", "-" e "1",
    // Nota (opcional) e faltas (último número) ficam no final
    const attValues: ("P" | "F")[] = [];
    let totalFaltasPDF = 0;
    let passingFaltas = false;

    for (let t = 0; t < attTokens.length; t++) {
      const tk = attTokens[t];
      if (!passingFaltas && isAtt(tk)) {
        attValues.push(isPresenca(tk) ? "P" : "F");
      } else if (/^\d+$/.test(tk)) {
        // Último número ao final é o total de faltas
        totalFaltasPDF = parseInt(tk);
        passingFaltas = true;
      }
    }

    // Montar frequências cruzando datas x presença
    const frequencias: { data: string; status: "P" | "F" }[] = datas.map(
      (data, idx) => ({ data, status: attValues[idx] ?? "P" })
    );

    if (nome) {
      alunos.push({ matricula, nome: normNome(nome), frequencias, totalFaltasPDF });
    }
  }

  if (alunos.length === 0) {
    erros.push(`Nenhum aluno encontrado na seção (verificar formato da tabela)`);
  }

  return alunos;
}

/* ─── Registro de atividades ───────────────────────────────────── */

function parseAtividades(linhas: string[], ano: number): AtividadeDiario[] {
  /*
   * Formato:
   *   04/02/2026    1      Conteúdo aqui...
   *   (linhas de continuação do conteúdo)
   *   05/02/2026    1      Outro conteúdo...
   */
  const atividades: AtividadeDiario[] = [];
  const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d+)\s+(.*)$/;
  let emRegistro = false;
  let atualIdx = -1;

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();

    if (/REGISTRO DE ATIVIDADES/i.test(l)) { emRegistro = true; continue; }
    if (!emRegistro) continue;

    // Nova data
    const m = l.match(dataRegex);
    if (m) {
      const [, dd, mm, aaaa, na, conteudo] = m;
      atividades.push({
        data: `${aaaa}-${mm}-${dd}`,
        numAulas: parseInt(na),
        conteudo: conteudo.trim(),
      });
      atualIdx = atividades.length - 1;
      continue;
    }

    // Continuação do conteúdo da última atividade
    if (atualIdx >= 0 && l && !/^Página\s+\d/i.test(l)) {
      atividades[atualIdx].conteudo += "\n" + l;
    }
  }

  return atividades;
}

/* ─── Utilitários exportados ───────────────────────────────────── */

export { normNome };

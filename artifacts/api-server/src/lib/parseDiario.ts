// @ts-nocheck
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
  nota: number | null; // Adicionado campo de nota
}

export interface AtividadeDiario {
  data: string;   // YYYY-MM-DD
  numAulas: number;
  conteudo: string;
}

export interface SecaoDiario {
  turmaCodigo: string;   // ex: "1AM01"
  turmaLocal: string;    // ex: "1A"
  disciplina: string;    // ex: "Língua Portuguesa"
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
  let disciplina = "";

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;

    // Tenta capturar do formato completo de Diário SUAP
    // ex: "56255 - FUND.0118 - 1º Ano - Língua Portuguesa - 1AT02   1"
    const mDiario = l.match(/\d+ - FUND\.\d+ - .*? - (.*?) - (\w+)\s+\d+/);
    if (mDiario) {
      disciplina = mDiario[1].trim();
      turmaCodigo = mDiario[2].trim();
    }

    // Tenta extrair a partir de "Turma:" no cabeçalho
    if (/^Turma:/i.test(l)) {
      const m = l.match(/Turma:\s*\(?([A-Z0-9]+)\)?/i);
      if (m) {
        turmaCodigo = m[1].trim();
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        const mProx = prox.match(/\(?([A-Z0-9]{4,7})\)?$/i) || prox.match(/\(([^)]+)\)/);
        if (mProx) {
          turmaCodigo = mProx[1].trim();
        }
      }
    }

    // Tenta extrair a disciplina a partir de "Diário:"
    if (/^Diário:/i.test(l)) {
      const m = l.match(/Diário:\s*(.*)/i);
      if (m && m[1].trim()) {
        disciplina = m[1].split("-")[0].trim();
      } else {
        const prox = linhas[i + 1]?.trim() ?? "";
        const partes = prox.split("-").map(p => p.trim());
        if (partes.length >= 3) {
          disciplina = partes.slice(2).join(" - ");
        } else {
          disciplina = partes[0];
        }
      }
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
    disciplina,
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
  // 1. Encontrar a linha "Dia"
  let diaIdx = -1;
  let diasStr = "";
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].replace(/\s+/g, ""); // remove espaços para unificar
    const m = l.match(/^Dia(\d{2,})/i);
    if (m) {
      diaIdx = i;
      diasStr = m[1];
      break;
    }
    // Fallback caso venha com espaços na linha original
    if (/^Dia/i.test(linhas[i]) && (linhas[i].match(/\b\d{1,2}\b/g) ?? []).length > 2) {
      diaIdx = i;
      break;
    }
  }
  if (diaIdx === -1) return [];

  // Extrair dias
  let dias: number[] = [];
  if (diasStr) {
    // Quebrar de 2 em 2
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

  // Se não encontrou linha de mês, tenta usar apenas o primeiro mês que aparecer perto
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
    const mes = (meses[i] ?? meses[meses.length - 1] ?? 1);
    const anoFinal = ano;
    return `${anoFinal}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

    // Caso 1: Layout quebrado em 3 linhas
    // Linha i: número sequencial (ex: "1")
    // Linha i+1: matrícula (ex: "20261031610017")
    // Linha i+2: nome + frequências + notas/faltas
    if (/^\d{1,2}$/.test(l) && i + 2 < linhas.length && /^\d{10,16}$/.test(linhas[i + 1].trim())) {
      const matricula = linhas[i + 1].trim();
      const nomeEFreq = linhas[i + 2].trim();
      
      const mNomeFreq = nomeEFreq.match(/^([A-Za-zÀ-ÿ'\s\.\-]+?)\s+([-\.·1\s]+)(.*)$/);
      if (mNomeFreq) {
        const nome = mNomeFreq[1].trim();
        // Remove espaços do bloco de frequências
        const freqRaw = mNomeFreq[2].replace(/\s+/g, "");
        const resto = mNomeFreq[3].trim();
        
        // Pega os primeiros dias.length caracteres
        const freqStr = freqRaw.substring(0, dias.length);
        
        const frequencias = datas.map((data, idx) => {
          const char = freqStr[idx] ?? ".";
          const status: "P" | "F" = (char === "1") ? "F" : "P";
          return { data, status };
        });

        let nota: number | null = null;
        let totalFaltasPDF = 0;
        const nums = resto.match(/\d+/g);
        if (nums) {
          if (nums.length >= 2) {
            totalFaltasPDF = Number(nums[0]);
            nota = Number(nums[1]) / 10;
          } else if (nums.length === 1) {
            totalFaltasPDF = Number(nums[0]);
          }
        }

        alunos.push({ matricula, nome: normNome(nome), frequencias, totalFaltasPDF, nota });
      }
      i += 3;
      continue;
    }

    // Caso 2: Layout em 1 linha
    const m1Linha = linhas[i].match(/^\s*(\d+)\s+(\d{10,16})\s+(.+)$/);
    if (m1Linha) {
      const matricula = m1Linha[2].trim();
      const restoLinha = m1Linha[3].trim();
      
      const mNomeFreq = restoLinha.match(/^([A-Za-zÀ-ÿ'\s\.\-]+?)\s+([-\.·1\s]+)(.*)$/);
      if (mNomeFreq) {
        const nome = mNomeFreq[1].trim();
        const freqRaw = mNomeFreq[2].replace(/\s+/g, "");
        const resto = mNomeFreq[3].trim();
        const freqStr = freqRaw.substring(0, dias.length);
        
        const frequencias = datas.map((data, idx) => {
          const char = freqStr[idx] ?? ".";
          const status: "P" | "F" = (char === "1") ? "F" : "P";
          return { data, status };
        });

        let nota: number | null = null;
        let totalFaltasPDF = 0;
        const nums = resto.match(/\d+/g);
        if (nums) {
          if (nums.length >= 2) {
            totalFaltasPDF = Number(nums[0]);
            nota = Number(nums[1]) / 10;
          } else if (nums.length === 1) {
            totalFaltasPDF = Number(nums[0]);
          }
        }

        alunos.push({ matricula, nome: normNome(nome), frequencias, totalFaltasPDF, nota });
      }
    }
    
    i++;
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

// @ts-nocheck
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { db, alunos, turmasTable } from "../../lib/db/src/index.ts";
import { eq, or, and, notInArray, sql } from "drizzle-orm";

export interface AlunoRow {
  [key: string]: any;
}

export interface ImportOptions {
  substituirTudo?: boolean;
  onProgress?: (pct: number, msg: string) => void;
}

/**
 * Função centralizada para importar/atualizar alunos a partir de uma lista de objetos (rows)
 */
export async function processarImportacaoAlunos(rows: AlunoRow[], options: ImportOptions = {}) {
  const { substituirTudo = false, onProgress } = options;
  
  if (rows.length === 0) return { sucesso: true, adicionados: 0, atualizados: 0 };

  const colunas = Object.keys(rows[0]);
  const mapearColuna = (chaves: string[]): string | undefined => {
    for (const k of chaves) {
      const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  };

  // Mapeamento de colunas (baseado na estrutura do SUAP)
  const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."]);
  const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"]);
  const colTurma        = mapearColuna(["turma", "turma/série"]);
  const colTurno        = mapearColuna(["turno"]);
  const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);
  const colNascimento   = mapearColuna(["data de nascimento", "nascimento", "data nasc", "nascimento_data"]);
  const colCPF          = mapearColuna(["cpf"]);
  const colRG           = mapearColuna(["rg"]);
  const colMae          = mapearColuna(["nome da mãe", "nome da mae", "mãe", "mae", "nome_mae"]);
  const colPai          = mapearColuna(["nome do pai", "pai", "nome_pai"]);
  const colResponsavel  = mapearColuna(["responsável", "responsavel"]);
  const colTelefone     = mapearColuna(["telefone", "celular", "fone", "telefones"]);
  const colEndereco     = mapearColuna(["endereço", "endereco", "logradouro", "get_endereco"]);
  const colZona         = mapearColuna(["zona", "zona residencial", "zona_residencial"]);
  const colSexo         = mapearColuna(["sexo", "gênero", "genero"]);
  const colEtnia        = mapearColuna(["etnia", "raça", "raca", "cor/raça", "pessoa_fisica.raca"]);
  const colEmailPessoal = mapearColuna(["e-mail", "email", "e-mail do aluno", "pessoa_fisica.email"]);
  const colEmailResp    = mapearColuna(["e-mail do responsável", "email responsavel", "email_responsavel"]);
  const colAnoIngresso  = mapearColuna(["ano de ingresso", "ano ingresso", "ano_letivo"]);
  const colNivel        = mapearColuna(["nível de ensino", "nivel ensino", "nivel"]);
  const colCurso        = mapearColuna(["descrição do curso", "curso", "descricao do curso", "curso_campus.descricao"]);
  const colCodCurso     = mapearColuna(["código do curso", "cod curso", "codigo curso", "curso_campus.codigo"]);
  const colPrevisao     = mapearColuna(["ano de previsão", "previsao conclusao", "ano_let_prev_conclusao"]);
  const colNaturalidade = mapearColuna(["naturalidade", "cidade natural", "cidade de nascimento"]);

  const formatarData = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date) {
      const d = val.getDate().toString().padStart(2, "0");
      const m = (val.getMonth() + 1).toString().padStart(2, "0");
      return `${d}/${m}/${val.getFullYear()}`;
    }
    const s = String(val).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.split("T")[0].split("-");
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return s;
  };

  const val = (row: AlunoRow, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  const extrairTurma = (raw: string): string => {
    const m = raw.match(/\(([^)]+)\)/);
    return m ? m[1].trim() : raw.trim();
  };

  let adicionados = 0;
  let atualizados = 0;
  let errosCount = 0;
  
  const matriculasNoArquivo = new Set<string>();
  const nomesNoArquivo = new Set<string>();
  const turmasEncontradas = new Set<string>();

  // Pré-carregar dados para matching
  const existentes = await db.select({
    id: alunos.id,
    matricula: alunos.matricula,
    nomeCompleto: alunos.nomeCompleto,
  }).from(alunos);
  
  const mapMatricula = new Map(existentes.map(a => [a.matricula, a.id]));
  const mapNome = new Map(existentes.map(a => [a.nomeCompleto.toLowerCase(), a.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const matricula = val(row, colMatricula);
      const nomeCompleto = val(row, colNome);
      if (!nomeCompleto) continue;

      if (matricula) matriculasNoArquivo.add(matricula);
      nomesNoArquivo.add(nomeCompleto.toLowerCase());

      const rawSituacao = val(row, colSituacao);
      const situacaoNormalized = String(rawSituacao).toLowerCase().includes("matriculado") 
        ? "Matriculado" 
        : (rawSituacao || "Matriculado");

      const turmaAtual = extrairTurma(val(row, colTurma));
      if (turmaAtual) turmasEncontradas.add(turmaAtual);

      const alunoData: any = {
        nomeCompleto,
        matricula: matricula || null,
        dataNascimento: formatarData(colNascimento ? row[colNascimento] : undefined),
        turmaAtual: turmaAtual || null,
        turno: val(row, colTurno) || null,
        situacao: situacaoNormalized,
        nomeMae: val(row, colMae) || null,
        nomePai: val(row, colPai) || null,
        responsavel: val(row, colResponsavel) || null,
        telefone: val(row, colTelefone) || null,
        endereco: val(row, colEndereco) || null,
        zonaResidencial: val(row, colZona) || null,
        sexo: val(row, colSexo)?.[0]?.toUpperCase() || null,
        etnia: val(row, colEtnia) || null,
        emailPessoal: val(row, colEmailPessoal) || null,
        emailResponsavel: val(row, colEmailResp) || null,
        anoIngresso: val(row, colAnoIngresso) || null,
        nivelEnsino: val(row, colNivel) || null,
        descricaoCurso: val(row, colCurso) || null,
        codigoCurso: val(row, colCodCurso) || null,
        anoPrevisaoConclusao: val(row, colPrevisao) || null,
        cpf: val(row, colCPF) || null,
        rg: val(row, colRG) || null,
        naturalidade: val(row, colNaturalidade) || null,
        arquivoMorto: 0, // Garante que volta ao arquivo ativo se estiver no XLS
      };

      let existingId = matricula ? mapMatricula.get(matricula) : mapNome.get(nomeCompleto.toLowerCase());

      if (existingId) {
        await db.update(alunos).set(alunoData).where(eq(alunos.id, existingId));
        atualizados++;
      } else {
        await db.insert(alunos).values(alunoData);
        adicionados++;
      }

      if (onProgress && i % 20 === 0) {
        onProgress(90 + Math.floor((i / rows.length) * 8), `Importando... ${i}/${rows.length}`);
      }
    } catch (err) {
      errosCount++;
      console.error(`Erro ao importar registro ${i}:`, err);
    }
  }

  // Lógica de "Substituir Tudo" / Transferidos
  let totalTransferidos = 0;
  if (substituirTudo) {
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    
    // Alunos que estão no BD mas não no arquivo e não estão marcados como saída
    const paraMarcarSaida = existentes.filter(a => {
      const matriculaMatch = a.matricula && matriculasNoArquivo.has(a.matricula);
      const nomeMatch = nomesNoArquivo.has(a.nomeCompleto.toLowerCase());
      return !matriculaMatch && !nomeMatch;
    });

    for (const a of paraMarcarSaida) {
      await db.update(alunos).set({
        situacao: "Transferido",
        arquivoMorto: 1,
        motivoSaida: "Não consta no relatório SUAP (Sincronização)",
        dataSaida: dataHoje,
        dataTransferencia: dataHoje
      }).where(eq(alunos.id, a.id));
      totalTransferidos++;
    }
  }

  // Sincronizar turmas
  for (const nomeTurma of turmasEncontradas) {
    const existing = await db.select().from(turmasTable).where(eq(turmasTable.nomeTurma, nomeTurma)).limit(1);
    if (existing.length === 0) {
      const upper = nomeTurma.toUpperCase();
      const turnoInferido = (upper.includes(" M") || upper.endsWith("M") || upper.includes("AM") || upper.includes("1M")) ? "Manhã" : "Tarde";
      await db.insert(turmasTable).values({ nomeTurma, turno: turnoInferido });
    }
  }

  return { sucesso: true, adicionados, atualizados, transferidos: totalTransferidos, erros: errosCount };
}

export async function importarAlunosXLS(filePath: string) {
  const workbook = readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = utils.sheet_to_json(worksheet);
  return processarImportacaoAlunos(data);
}

// @ts-nocheck
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { db, alunos, turmasTable } from "../lib/db/index.js";
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
  
  if (rows.length === 0) return { sucesso: true, adicionados: 0, atualizados: 0, detalhes: { adicionados: [], atualizados: [], transferidos: [] } };

  const colunas = Object.keys(rows[0]);
  const mapearColuna = (chaves: string[], fallbackIdx?: number): string | undefined => {
    for (const k of chaves) {
      const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (match) return match;
    }
    if (fallbackIdx !== undefined && fallbackIdx >= 0 && fallbackIdx < colunas.length) {
      return colunas[fallbackIdx];
    }
    return undefined;
  };

  // Mapeamento de colunas (baseado na estrutura do SUAP)
  const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."], 1);
  const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"], 2);
  const colTurma        = mapearColuna(["turma", "turma/série"], colunas.length > 74 ? 74 : 71);
  const colTurno        = mapearColuna(["turno"]);
  const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);
  const colNascimento   = mapearColuna(["data de nascimento", "nascimento", "data nasc", "nascimento_data"]);
  const colCPF          = mapearColuna(["cpf"], 7);
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
  const colCodCurso     = mapearColuna(["código do curso", "código curso", "cod curso", "codigo curso", "curso_campus.codigo"]);
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

  const extrairTurma = (raw: string): string | null => {
    if (!raw) return null;
    const m = raw.match(/\(([^)]+)\)/);
    if (m) return m[1].trim();
    
    const clean = raw.trim();
    if (clean.length <= 10 && !clean.includes(".")) return clean;
    
    return null;
  };

  let adicionados = 0;
  let atualizados = 0;
  let errosCount = 0;
  const nomesAdicionados = [];
  const nomesAtualizados = [];
  const nomesTransferidos = [];
  
  const matriculasNoArquivo = new Set<string>();
  const nomesNoArquivo = new Set<string>();
  const turmasExistentes = await db.select().from(turmasTable);
  const setTurmasExistentes = new Set(turmasExistentes.map(t => t.nomeTurma.toLowerCase().trim()));

  let existentes = await db.select({
    id: alunos.id,
    matricula: alunos.matricula,
    nomeCompleto: alunos.nomeCompleto,
    cpf: alunos.cpf,
  }).from(alunos);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const matricula = val(row, colMatricula);
      const nomeCompleto = val(row, colNome);
      if (!nomeCompleto) continue;

      const turmaAtual = extrairTurma(val(row, colTurma));
      const turmaAtualClean = turmaAtual ? turmaAtual.toLowerCase().trim() : "";

      if (matricula) matriculasNoArquivo.add(matricula);
      nomesNoArquivo.add(nomeCompleto.toLowerCase());

      const rawSituacao = val(row, colSituacao);
      const situacaoNormalized = String(rawSituacao).toLowerCase().includes("matriculado") 
        ? "Matriculado" 
        : (rawSituacao || "Matriculado");

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
        arquivoMorto: 0,
      };

      const cpfLimpo = alunoData.cpf ? alunoData.cpf.replace(/\D/g, "") : "";
      let existingId: number | undefined = undefined;

      if (cpfLimpo) {
        const matchingByCpf = existentes.filter(a => a.cpf && a.cpf.replace(/\D/g, "") === cpfLimpo);
        if (matchingByCpf.length > 0) {
          matchingByCpf.sort((a, b) => b.id - a.id);
          existingId = matchingByCpf[0].id;
          for (let idx = 1; idx < matchingByCpf.length; idx++) {
            const dupId = matchingByCpf[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId));
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      if (!existingId && matricula) {
        const matchingByMatricula = existentes.filter(a => a.matricula === matricula);
        if (matchingByMatricula.length > 0) {
          matchingByMatricula.sort((a, b) => b.id - a.id);
          existingId = matchingByMatricula[0].id;
          for (let idx = 1; idx < matchingByMatricula.length; idx++) {
            const dupId = matchingByMatricula[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId));
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      if (!existingId) {
        const nomeClean = nomeCompleto.toLowerCase().trim();
        const matchingByName = existentes.filter(a => a.nomeCompleto.toLowerCase().trim() === nomeClean);
        if (matchingByName.length > 0) {
          matchingByName.sort((a, b) => b.id - a.id);
          existingId = matchingByName[0].id;
          for (let idx = 1; idx < matchingByName.length; idx++) {
            const dupId = matchingByName[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId));
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      if (existingId) {
        await db.update(alunos).set(alunoData).where(eq(alunos.id, existingId));
        const idx = existentes.findIndex(e => e.id === existingId);
        if (idx !== -1) {
          existentes[idx] = { id: existingId, matricula: alunoData.matricula, nomeCompleto: alunoData.nomeCompleto, cpf: alunoData.cpf };
        }
        atualizados++;
        nomesAtualizados.push(nomeCompleto);
      } else {
        const [inserted] = await db.insert(alunos).values(alunoData).returning({ id: alunos.id });
        existentes.push({ id: inserted.id, matricula: alunoData.matricula, nomeCompleto: alunoData.nomeCompleto, cpf: alunoData.cpf });
        adicionados++;
        nomesAdicionados.push(nomeCompleto);
      }

      if (onProgress && i % 20 === 0) {
        onProgress(90 + Math.floor((i / rows.length) * 8), `Importando... ${i}/${rows.length}`);
      }
    } catch (err) {
      errosCount++;
      console.error(`Erro ao importar registro ${i}:`, err);
    }
  }

  let totalTransferidos = 0;
  if (substituirTudo) {
    const dataHoje = new Date().toLocaleDateString("pt-BR");
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
      nomesTransferidos.push(a.nomeCompleto);
    }
  }

  return { 
    sucesso: true, 
    adicionados, 
    atualizados, 
    transferidos: totalTransferidos, 
    erros: errosCount,
    detalhes: {
      adicionados: nomesAdicionados,
      atualizados: nomesAtualizados,
      transferidos: nomesTransferidos
    }
  };
}

export async function importarAlunosXLS(filePath: string) {
  const workbook = readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = utils.sheet_to_json(worksheet);
  return processarImportacaoAlunos(data);
}

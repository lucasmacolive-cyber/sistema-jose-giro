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
 * Sanitiza e padroniza CPF para exatamente 11 dígitos numéricos com zeros à esquerda
 */
export function cleanCPF(val: any): string {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0");
}

/**
 * Normaliza nomes removendo acentos, caracteres especiais e espaços extras
 */
export function normName(val: any): string {
  if (!val) return "";
  return String(val)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

  // Carregar turmas existentes na escola
  const turmasExistentes = await db.select().from(turmasTable);
  const setTurmasExistentes = new Set(turmasExistentes.map(t => t.nomeTurma.toLowerCase().trim()));

  const extrairInformacoesTurma = (rawCell: string, rawTurnoCell?: string) => {
    if (!rawCell) return { turma: "", ano: "", turno: "" };
    const raw = String(rawCell).trim();
    const tNorm = String(rawTurnoCell || '').trim().toLowerCase();

    let turma = "";

    // 1. Tentar casar diretamente com o nome exato de uma turma cadastrada na escola
    const rawClean = raw.toLowerCase().trim();
    const matchedDirect = turmasExistentes.find(t => t.nomeTurma.toLowerCase().trim() === rawClean);
    if (matchedDirect) {
      turma = matchedDirect.nomeTurma;
    } else {
      // Tentar dentro dos parênteses
      const mParen = raw.match(/\(([^)]+)\)/);
      if (mParen && mParen[1]) {
        const inside = mParen[1].trim();
        const insideMatch = turmasExistentes.find(t => t.nomeTurma.toLowerCase().trim() === inside.toLowerCase());
        if (insideMatch) {
          turma = insideMatch.nomeTurma;
        } else if (!/^(19|20)\d{2}(\.[0-9]+|\/[0-9]+)?$/.test(inside)) {
          turma = inside;
        }
      }
    }

    if (!turma) {
      const before = raw.split("(")[0].trim();
      const beforeMatch = turmasExistentes.find(t => t.nomeTurma.toLowerCase().trim() === before.toLowerCase());
      if (beforeMatch) {
        turma = beforeMatch.nomeTurma;
      } else {
        turma = (before.length <= 20) ? before : raw;
      }
    }

    // Resolução inteligente da turma com base na estrutura da escola e no turno
    if (turma.startsWith("1A") || raw.includes("1.03161")) {
      if (tNorm.includes("manh")) turma = "1AM01";
      else if (tNorm.includes("tarde")) turma = "1AT02";
    } else if (turma.startsWith("2A") || raw.includes("2.03161")) {
      if (tNorm.includes("manh")) turma = "2AM01";
      else if (tNorm.includes("tarde")) turma = "2AT02";
    } else if (turma.startsWith("3A") || raw.includes("3.03161")) {
      if (tNorm.includes("manh")) turma = "3AM01";
      else if (tNorm.includes("tarde")) turma = "3AT02";
    } else if (turma.startsWith("4A") || raw.includes("4.03161")) {
      if (tNorm.includes("manh")) turma = "4AM01";
      else if (tNorm.includes("tarde")) turma = "4AT01";
    } else if (turma.startsWith("5A") || raw.includes("5.03161")) {
      if (tNorm.includes("tarde")) turma = "5AT01";
      else if (tNorm.includes("manh")) turma = "5AM01";
    } else if (turma.startsWith("P1") || raw.includes("P1") || raw.includes("4.02161")) {
      if (tNorm.includes("manh")) turma = "P1M01";
      else if (tNorm.includes("tarde")) turma = "P1T02";
    } else if (turma.startsWith("P2") || raw.includes("P2") || raw.includes("5.02161")) {
      if (tNorm.includes("manh")) turma = "P2M01";
      else if (tNorm.includes("tarde")) turma = "P2T02";
    } else if (turma.startsWith("G2") || raw.includes("2.02161")) {
      if (tNorm.includes("tarde")) turma = "G2T01";
    } else if (turma.startsWith("G3") || raw.includes("3.02161")) {
      if (tNorm.includes("manh")) turma = "G3M01";
      else if (tNorm.includes("tarde")) turma = "G3T01";
    }

    let ano = "";
    const mAno = raw.match(/^(20\d{2})/);
    if (mAno) ano = mAno[1];

    let turno = rawTurnoCell || "";
    if (!turno) {
      const mTurno = raw.match(/([MTNI])\s*\(/i);
      if (mTurno) {
        const code = mTurno[1].toUpperCase();
        if (code === "M") turno = "Manhã";
        else if (code === "T") turno = "Tarde";
        else if (code === "N") turno = "Noite";
        else if (code === "I") turno = "Integral";
      }
    }

    return { turma, ano, turno };
  };

  let adicionados = 0;
  let atualizados = 0;
  let errosCount = 0;
  const nomesAdicionados: string[] = [];
  const nomesAtualizados: string[] = [];
  const nomesTransferidos: string[] = [];
  
  const matriculasNoArquivo = new Set<string>();
  const nomesNormNoArquivo = new Set<string>();
  const cpfsNoArquivo = new Set<string>();

  // --- AUTO-RESTORE INATIVADOS INDEVIDAMENTE ---
  // Se algum aluno foi arquivado automaticamente por erro de sincronização anterior,
  // nós restauramos o status de ativo dele para que o matching prioritário por CPF o atualize normalmente.
  try {
    await db.update(alunos)
      .set({
        arquivoMorto: 0,
        situacao: "Matriculado",
        motivoSaida: null,
        dataSaida: null,
        dataTransferencia: null
      })
      .where(
        and(
          eq(alunos.arquivoMorto, 1),
          or(
            ilike(alunos.motivoSaida, "%Não consta no relatório SUAP%"),
            ilike(alunos.motivoSaida, "%Sincronização%")
          )
        )
      );
  } catch (restoreErr) {
    console.error("[ImportService] Erro na restauração automática:", restoreErr);
  }

  // Pré-carregar dados dos alunos no banco
  let existentes = await db.select({
    id: alunos.id,
    matricula: alunos.matricula,
    nomeCompleto: alunos.nomeCompleto,
    cpf: alunos.cpf,
    turmaAtual: alunos.turmaAtual,
    arquivoMorto: alunos.arquivoMorto,
  }).from(alunos);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const matricula = val(row, colMatricula);
      const nomeCompleto = val(row, colNome);
      if (!nomeCompleto || nomeCompleto.length < 3) {
        errosCount++;
        continue;
      }

      const rawTurmaCell = val(row, colTurma);
      const rawTurnoCell = val(row, colTurno);
      const { turma: turmaExtraida, ano: anoExtraido, turno: turnoExtraido } = extrairInformacoesTurma(rawTurmaCell, rawTurnoCell);
      
      const turmaValida = turmaExtraida && setTurmasExistentes.has(turmaExtraida.toLowerCase().trim());
      
      const rawCpf = val(row, colCPF);
      const cpfLimpoVal = cleanCPF(rawCpf);

      if (matricula) matriculasNoArquivo.add(matricula);
      if (nomeCompleto) nomesNormNoArquivo.add(normName(nomeCompleto));
      if (cpfLimpoVal) cpfsNoArquivo.add(cpfLimpoVal);

      const rawSituacao = val(row, colSituacao);
      const isMatriculado = String(rawSituacao).toLowerCase().includes("matriculado");
      const situacaoNormalized = isMatriculado ? "Matriculado" : (rawSituacao || "Matriculado");
      const isSaida = ["transferido", "cancelado", "concluído", "concluido", "evadido", "jubilado"].some(s =>
        situacaoNormalized.toLowerCase().includes(s)
      );

      const cpfLimpo = cleanCPF(rawCpf);
      let existingRecord: typeof existentes[0] | undefined = undefined;

      // ── PRIORIDADE 1: Match por CPF Limpo e Padronizado (11 dígitos) ───────────
      if (cpfLimpo) {
        const matchingByCpf = existentes.filter(a => cleanCPF(a.cpf) === cpfLimpo);
        if (matchingByCpf.length > 0) {
          matchingByCpf.sort((a, b) => b.id - a.id);
          existingRecord = matchingByCpf[0];
          
          for (let idx = 1; idx < matchingByCpf.length; idx++) {
            const dupId = matchingByCpf[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId)).catch(() => {});
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      // ── PRIORIDADE 2: Match por Matrícula ─────────────────────────────────────
      if (!existingRecord && matricula) {
        const matchingByMatricula = existentes.filter(a => a.matricula === matricula);
        if (matchingByMatricula.length > 0) {
          matchingByMatricula.sort((a, b) => b.id - a.id);
          existingRecord = matchingByMatricula[0];
          
          for (let idx = 1; idx < matchingByMatricula.length; idx++) {
            const dupId = matchingByMatricula[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId)).catch(() => {});
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      // ── PRIORIDADE 3: Match por Nome Normalizado (Sem acentos, minúsculo) ──────
      if (!existingRecord) {
        const nomeNorm = normName(nomeCompleto);
        const matchingByName = existentes.filter(a => normName(a.nomeCompleto) === nomeNorm);
        if (matchingByName.length > 0) {
          matchingByName.sort((a, b) => b.id - a.id);
          existingRecord = matchingByName[0];
          
          for (let idx = 1; idx < matchingByName.length; idx++) {
            const dupId = matchingByName[idx].id;
            await db.delete(alunos).where(eq(alunos.id, dupId)).catch(() => {});
            const idxExistente = existentes.findIndex(e => e.id === dupId);
            if (idxExistente !== -1) existentes.splice(idxExistente, 1);
          }
        }
      }

      // Se a turma extraída não for válida em turmasTable, mantém a turmaAtual que o aluno já tinha
      const turmaFinal = turmaValida ? turmaExtraida : (existingRecord?.turmaAtual || null);

      const alunoData: any = {
        nomeCompleto,
        matricula: matricula || null,
        dataNascimento: formatarData(colNascimento ? row[colNascimento] : undefined),
        turmaAtual: turmaFinal,
        turno: turnoExtraido || val(row, colTurno) || null,
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
        anoIngresso: val(row, colAnoIngresso) || anoExtraido || null,
        nivelEnsino: val(row, colNivel) || null,
        descricaoCurso: val(row, colCurso) || null,
        codigoCurso: val(row, colCodCurso) || null,
        anoPrevisaoConclusao: val(row, colPrevisao) || null,
        cpf: rawCpf || null,
        rg: val(row, colRG) || null,
        naturalidade: val(row, colNaturalidade) || null,
        arquivoMorto: isSaida ? 1 : 0,
      };

      if (existingRecord) {
        await db.update(alunos).set(alunoData).where(eq(alunos.id, existingRecord.id));
        
        const idx = existentes.findIndex(e => e.id === existingRecord.id);
        if (idx !== -1) {
          existentes[idx] = {
            id: existingRecord.id,
            matricula: alunoData.matricula,
            nomeCompleto: alunoData.nomeCompleto,
            cpf: alunoData.cpf,
            turmaAtual: alunoData.turmaAtual,
            arquivoMorto: alunoData.arquivoMorto,
          };
        }
        atualizados++;
        nomesAtualizados.push(nomeCompleto);
      } else {
        const [inserted] = await db.insert(alunos).values(alunoData).returning({ id: alunos.id });
        existentes.push({
          id: inserted.id,
          matricula: alunoData.matricula,
          nomeCompleto: alunoData.nomeCompleto,
          cpf: alunoData.cpf,
          turmaAtual: alunoData.turmaAtual,
          arquivoMorto: alunoData.arquivoMorto,
        });
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

  // ── Lógica de "Substituir Tudo" / Transferidos (com trava de segurança) ───────
  let totalTransferidos = 0;
  if (substituirTudo) {
    const totalProcessados = adicionados + atualizados;
    const limiteMinimoSeguranca = Math.max(50, Math.floor(existentes.length * 0.70));

    if (!colNome || totalProcessados < limiteMinimoSeguranca) {
      console.warn(`[ImportService] TRAVA DE SEGURANÇA ATIVADA: Apenas ${totalProcessados} alunos lidos (Mínimo exigido: ${limiteMinimoSeguranca}). Substituição total de arquivo_morto abortada.`);
      return { 
        sucesso: true, 
        adicionados, 
        atualizados, 
        transferidos: 0, 
        erros: errosCount, 
        mensagem: `Aviso de Segurança: Foram processados ${totalProcessados} alunos. O arquivamento automático foi suspenso para proteger os cadastros existentes (exigido no mínimo ${limiteMinimoSeguranca} alunos).`,
        detalhes: { adicionados: nomesAdicionados, atualizados: nomesAtualizados, transferidos: [] }
      };
    }

    const dataHoje = new Date().toLocaleDateString("pt-BR");
    
    // Alunos que estão atualmente ATIVOS no BD (arquivoMorto === 0), mas NÃO foram encontrados no arquivo
    const ativosExistentes = existentes.filter(a => a.arquivoMorto === 0);
    const paraMarcarSaida = ativosExistentes.filter(a => {
      const matriculaMatch = a.matricula && matriculasNoArquivo.has(a.matricula);
      const nomeMatch = a.nomeCompleto && nomesNormNoArquivo.has(normName(a.nomeCompleto));
      const cpfClean = cleanCPF(a.cpf);
      const cpfMatch = cpfClean && cpfsNoArquivo.has(cpfClean);
      return !matriculaMatch && !nomeMatch && !cpfMatch;
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

  const rawMatrix: any[][] = utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const data: any[] = utils.sheet_to_json(worksheet, { defval: "", range: headerRowIdx });
  return processarImportacaoAlunos(data);
}

export async function realocarAlunosPorPlanilhaTurma(
  rowsTurma: Record<string, any>[],
  nomeTurmaDestino: string,
  turnoDestino: string
) {
  if (!rowsTurma || rowsTurma.length === 0) return { movidos: 0, mantidos: 0 };

  const colunas = Object.keys(rowsTurma[0]);
  const mapearColuna = (chaves: string[]): string | undefined => {
    for (const k of chaves) {
      const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  };

  const colNome = mapearColuna(["nome completo", "nome do aluno", "nome"]);
  const colMatricula = mapearColuna(["matrícula", "matricula", "mat."]);
  const colCPF = mapearColuna(["cpf"]);

  const val = (row: any, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  let movidos = 0;
  let mantidos = 0;

  const todosAlunos = await db.select().from(alunos);

  for (const r of rowsTurma) {
    const nome = val(r, colNome);
    const mat = val(r, colMatricula);
    const cpfClean = cleanCPF(val(r, colCPF));

    if (!nome || nome.length < 3) continue;

    let aluno = todosAlunos.find(a => cleanCPF(a.cpf) === cpfClean);
    if (!aluno && mat) aluno = todosAlunos.find(a => a.matricula === mat);
    if (!aluno) aluno = todosAlunos.find(a => normName(a.nomeCompleto) === normName(nome));

    if (aluno) {
      const jaNoLugarCerto =
        aluno.turmaAtual === nomeTurmaDestino &&
        aluno.turno === turnoDestino &&
        aluno.arquivoMorto === 0;

      if (jaNoLugarCerto) {
        mantidos++;
      } else {
        await db.update(alunos).set({
          turmaAtual: nomeTurmaDestino,
          turno: turnoDestino,
          situacao: "Matriculado",
          arquivoMorto: 0,
        }).where(eq(alunos.id, aluno.id));

        console.log(`[Realocador Turmas] Aluno "${aluno.nomeCompleto}" realocado para turma ${nomeTurmaDestino} (${turnoDestino}).`);
        movidos++;
      }
    }
  }

  return { movidos, mantidos };
}

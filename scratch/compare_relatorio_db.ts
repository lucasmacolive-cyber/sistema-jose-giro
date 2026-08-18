import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import pkg from "xlsx";
const { readFile, utils } = pkg;

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const xlsPath = path.join(process.cwd(), 'Relatorio (1).xls');
  const wb = readFile(xlsPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows: Record<string, any>[] = utils.sheet_to_json(sheet, {
    defval: "",
    range: headerRowIdx,
  });

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

  const colMatricula = mapearColuna(["matrícula", "matricula", "mat."], 1);
  const colNome      = mapearColuna(["nome completo", "nome do aluno", "nome"], 2);
  const colTurma     = mapearColuna(["turma", "turma/série"], colunas.length > 74 ? 74 : 71);
  const colCPF       = mapearColuna(["cpf"], 7);

  const val = (row: any, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  const extrairInformacoesTurma = (rawCell: string) => {
    if (!rawCell) return { turma: "", ano: "", turno: "" };
    const raw = String(rawCell).trim();

    // Extrai a sigla da turma de dentro dos parênteses: ex "20261.3.03161.1M (3AM01)" -> "3AM01"
    let turma = "";
    const mParen = raw.match(/\(([^)]+)\)/);
    if (mParen && mParen[1]) {
      const inside = mParen[1].trim();
      if (!/^(19|20)\d{2}(\.[0-9]+|\/[0-9]+)?$/.test(inside)) {
        turma = inside;
      }
    }

    if (!turma) {
      const before = raw.split("(")[0].trim();
      turma = (before.length <= 20) ? before : raw;
    }

    return { turma, rawCell };
  };

  // Turmas no BD
  const turmasRes = await pool.query("SELECT nome_turma FROM turmas;");
  const setTurmasExistentes = new Set(turmasRes.rows.map(t => t.nome_turma.toLowerCase().trim()));
  console.log("Turmas no BD:", Array.from(setTurmasExistentes));

  // Alunos no BD
  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, cpf, turma_atual, turno, situacao, arquivo_morto FROM alunos;");
  const dbAlunos = dbAlunosRes.rows;

  console.log(`\nComparando ${rows.length} linhas do Excel com ${dbAlunos.length} alunos no BD:\n`);

  let diferencaTurmaCount = 0;
  let diferencaTurnoCount = 0;
  let diferencaTurmaList: any[] = [];

  for (const row of rows) {
    const nomeExcel = val(row, colNome);
    const matExcel = val(row, colMatricula);
    const cpfExcel = val(row, colCPF);
    const cpfClean = cpfExcel ? cpfExcel.replace(/\D/g, "") : "";
    const rawTurma = val(row, colTurma);
    const { turma: turmaExtraida } = extrairInformacoesTurma(rawTurma);

    // Validação da turma extraída
    const turmaValida = turmaExtraida && setTurmasExistentes.has(turmaExtraida.toLowerCase().trim());
    const turmaFinalExcel = turmaValida ? turmaExtraida : (turmaExtraida || null);

    // Encontrar no BD por CPF, Matricula ou Nome
    let matchInDb = dbAlunos.find(a => a.cpf && String(a.cpf).replace(/\D/g, "") === cpfClean);
    if (!matchInDb && matExcel) {
      matchInDb = dbAlunos.find(a => a.matricula === matExcel);
    }
    if (!matchInDb && nomeExcel) {
      matchInDb = dbAlunos.find(a => String(a.nome_completo).toLowerCase().trim() === nomeExcel.toLowerCase().trim());
    }

    if (matchInDb) {
      const turmaDb = matchInDb.turma_atual ?? "";
      const turmaExcel = turmaFinalExcel ?? "";

      if (turmaDb.toLowerCase().trim() !== turmaExcel.toLowerCase().trim()) {
        diferencaTurmaCount++;
        diferencaTurmaList.push({
          id: matchInDb.id,
          nome: matchInDb.nome_completo,
          matricula: matchInDb.matricula,
          turmaNoBD: matchInDb.turma_atual,
          turmaNoExcelBruta: rawTurma,
          turmaNoExcelExtraida: turmaExtraida,
          turmaNoExcelValida: turmaValida,
          turmaFinalExcel: turmaFinalExcel
        });
      }
    }
  }

  console.log(`=== ALUNOS COM DIFERENÇA DE TURMA (EXCEL vs BD): ${diferencaTurmaCount} ===`);
  console.table(diferencaTurmaList);

  await pool.end();
}

main();

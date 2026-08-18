import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import pkg from "xlsx";
const { readFile, utils } = pkg;

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function inspectExcelFile(filename: string) {
  const xlsPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(xlsPath)) return [];

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

  return rows;
}

async function main() {
  const dbRes = await pool.query(`
    SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf, sexo 
    FROM alunos 
    WHERE (turma_atual ILIKE '1AM%' OR turma_atual ILIKE '1AT%')
    ORDER BY turma_atual, nome_completo;
  `);

  console.log(`=== TODOS OS ALUNOS DO 1º ANO NO BANCO DE DADOS (${dbRes.rows.length}) ===\n`);
  
  const rel1Rows = inspectExcelFile("Relatorio (1).xls");
  const rel1775Rows = inspectExcelFile("attached_assets/Relatorio_1775062608705.xls");
  const rel18Rows = inspectExcelFile("attached_assets/Relatorio_(18)_1775062997555.xls");

  const findInRows = (rows: Record<string, any>[], nameOrMat: string) => {
    const term = nameOrMat.toLowerCase().trim();
    for (const r of rows) {
      const keys = Object.keys(r);
      const colNome = keys.find(k => k.toLowerCase().includes("nome"));
      const colTurma = keys.find(k => k.toLowerCase().includes("turma"));
      const colMat = keys.find(k => k.toLowerCase().includes("matr"));
      const nomeVal = colNome ? String(r[colNome] ?? "").trim() : "";
      const matVal = colMat ? String(r[colMat] ?? "").trim() : "";
      const turmaVal = colTurma ? String(r[colTurma] ?? "").trim() : "";

      if (nomeVal.toLowerCase().includes(term) || matVal.includes(term)) {
        return { nome: nomeVal, mat: matVal, turma: turmaVal };
      }
    }
    return null;
  };

  const comparison = dbRes.rows.map(a => {
    const inRel1 = findInRows(rel1Rows, a.nome_completo) || findInRows(rel1Rows, a.matricula);
    const inRel1775 = findInRows(rel1775Rows, a.nome_completo) || findInRows(rel1775Rows, a.matricula);
    const inRel18 = findInRows(rel18Rows, a.nome_completo) || findInRows(rel18Rows, a.matricula);

    return {
      id: a.id,
      nome: a.nome_completo,
      turmaBD: a.turma_atual,
      turnoBD: a.turno,
      turmaRelatorio1: inRel1?.turma ?? "Não enc.",
      turmaRelatorio1775: inRel1775?.turma ?? "Não enc.",
      turmaRelatorio18: inRel8(inRel18)
    };
  });

  function inRel8(item: any) {
    return item?.turma ?? "Não enc.";
  }

  console.table(comparison);

  await pool.end();
}

main();

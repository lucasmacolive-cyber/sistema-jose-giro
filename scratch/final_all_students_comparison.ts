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

const extrairTurma = (rawCell: string) => {
  if (!rawCell) return "";
  const raw = String(rawCell).trim();
  const mParen = raw.match(/\(([^)]+)\)/);
  if (mParen && mParen[1]) {
    const inside = mParen[1].trim();
    if (!/^(19|20)\d{2}(\.[0-9]+|\/[0-9]+)?$/.test(inside)) {
      return inside;
    }
  }
  const before = raw.split("(")[0].trim();
  return (before.length <= 20) ? before : raw;
};

async function main() {
  const dbRes = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf FROM alunos ORDER BY nome_completo;");
  const alunosDb = dbRes.rows;

  const rowsLatest = inspectExcelFile("attached_assets/Relatorio_(18)_1775062997555.xls");

  let mismatches: any[] = [];
  let matchingCount = 0;

  for (const r of rowsLatest) {
    const keys = Object.keys(r);
    const colNome = keys.find(k => k.toLowerCase().includes("nome"));
    const colTurma = keys.find(k => k.toLowerCase().includes("turma"));
    const colMat = keys.find(k => k.toLowerCase().includes("matr"));
    const colCpf = keys.find(k => k.toLowerCase().includes("cpf"));

    const nomeExcel = colNome ? String(r[colNome] ?? "").trim() : "";
    const matExcel = colMat ? String(r[colMat] ?? "").trim() : "";
    const cpfExcel = colCpf ? String(r[colCpf] ?? "").replace(/\D/g, "") : "";
    const rawTurma = colTurma ? String(r[colTurma] ?? "").trim() : "";
    const turmaExcel = extrairTurma(rawTurma);

    if (!nomeExcel) continue;

    let match = alunosDb.find(a => a.cpf && String(a.cpf).replace(/\D/g, "") === cpfExcel);
    if (!match && matExcel) match = alunosDb.find(a => a.matricula === matExcel);
    if (!match) match = alunosDb.find(a => String(a.nome_completo).toLowerCase().trim() === nomeExcel.toLowerCase().trim());

    if (match) {
      if (match.turma_atual !== turmaExcel) {
        mismatches.push({
          id: match.id,
          nome: match.nome_completo,
          turmaNoBanco: match.turma_atual,
          turnoNoBanco: match.turno,
          turmaNoRelatorioExcel: turmaExcel,
          rawTurmaExcel: rawTurma
        });
      } else {
        matchingCount++;
      }
    }
  }

  console.log(`Total de alunos analisados no arquivo Excel mais recente: ${rowsLatest.length}`);
  console.log(`Total de alunos 100% idênticos entre o Banco e o Relatório: ${matchingCount}`);
  console.log(`Total de divergências encontradas: ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.table(mismatches);
  }

  await pool.end();
}

main();

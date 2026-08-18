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
  // Find all .xls files
  const files: string[] = [];

  const searchDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        searchDir(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xls")) {
        files.push(full);
      }
    }
  };

  searchDir(process.cwd());
  console.log(`Found ${files.length} .xls files:\n`);

  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, cpf, turma_atual, turno FROM alunos;");
  const dbAlunos = dbAlunosRes.rows;

  for (const f of files) {
    try {
      const wb = readFile(f);
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

      if (rows.length === 0) {
        console.log(`File: ${path.basename(f)} — 0 rows (skipped)`);
        continue;
      }

      const colunas = Object.keys(rows[0]);
      const mapearColuna = (chaves: string[]): string | undefined => {
        for (const k of chaves) {
          const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
          if (match) return match;
        }
        return undefined;
      };

      const colNome = mapearColuna(["nome completo", "nome do aluno", "nome"]);
      const colTurma = mapearColuna(["turma", "turma/série"]);
      const colMatricula = mapearColuna(["matrícula", "matricula", "mat."]);
      const colCPF = mapearColuna(["cpf"]);

      if (!colNome || !colTurma) {
        console.log(`File: ${path.basename(f)} — Missing colNome (${colNome}) or colTurma (${colTurma})`);
        continue;
      }

      console.log(`\n========================================`);
      console.log(`File: ${path.basename(f)} (${rows.length} rows)`);
      console.log(`Path: ${f}`);

      let diffs: any[] = [];

      for (const r of rows) {
        const nome = String(r[colNome] ?? "").trim();
        const mat = colMatricula ? String(r[colMatricula] ?? "").trim() : "";
        const cpf = colCPF ? String(r[colCPF] ?? "").trim().replace(/\D/g, "") : "";
        const rawTurma = String(r[colTurma] ?? "").trim();
        const turmaExt = extrairTurma(rawTurma);

        if (!nome || nome.length < 3) continue;

        let dbStudent = dbAlunos.find(a => a.cpf && String(a.cpf).replace(/\D/g, "") === cpf);
        if (!dbStudent && mat) dbStudent = dbAlunos.find(a => a.matricula === mat);
        if (!dbStudent) dbStudent = dbAlunos.find(a => String(a.nome_completo).toLowerCase().trim() === nome.toLowerCase().trim());

        if (dbStudent) {
          const tDb = (dbStudent.turma_atual ?? "").trim();
          if (tDb.toLowerCase() !== turmaExt.toLowerCase()) {
            diffs.push({
              nome: dbStudent.nome_completo,
              turmaNoBD: tDb,
              turmaNoExcelExtraida: turmaExt,
              rawTurmaCellInExcel: rawTurma
            });
          }
        }
      }

      console.log(`Differences in turma vs DB: ${diffs.length}`);
      if (diffs.length > 0) {
        console.table(diffs.slice(0, 15));
      }
    } catch (e: any) {
      console.error(`Error reading ${f}:`, e.message);
    }
  }

  await pool.end();
}

main();

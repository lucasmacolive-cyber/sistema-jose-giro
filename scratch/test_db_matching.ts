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

  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });

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
  const colCPF       = mapearColuna(["cpf"], 7);

  const val = (row: any, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  // Load existing DB alunos
  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, cpf, situacao, arquivo_morto FROM alunos;");
  const existentes = dbAlunosRes.rows;

  console.log("Total alunos in DB:", existentes.length);

  let matchCpf = 0;
  let matchMatricula = 0;
  let matchNome = 0;
  let noMatch = 0;

  for (const row of rows) {
    const matricula = val(row, colMatricula);
    const nomeCompleto = val(row, colNome);
    const cpf = val(row, colCPF);
    const cpfLimpo = cpf ? cpf.replace(/\D/g, "") : "";

    let matched = false;

    if (cpfLimpo) {
      const mCpf = existentes.filter(a => a.cpf && String(a.cpf).replace(/\D/g, "") === cpfLimpo);
      if (mCpf.length > 0) { matchCpf++; matched = true; }
    }
    if (!matched && matricula) {
      const mMat = existentes.filter(a => a.matricula === matricula);
      if (mMat.length > 0) { matchMatricula++; matched = true; }
    }
    if (!matched && nomeCompleto) {
      const mNome = existentes.filter(a => String(a.nome_completo).toLowerCase().trim() === nomeCompleto.toLowerCase().trim());
      if (mNome.length > 0) { matchNome++; matched = true; }
    }

    if (!matched) {
      noMatch++;
      console.log("Row in Excel NOT matched in DB:", { matricula, nomeCompleto, cpf });
    }
  }

  console.log("\n=== MATCH RESULTS FOR EXCEL ROWS ===");
  console.log("Matched by CPF:", matchCpf);
  console.log("Matched by Matricula:", matchMatricula);
  console.log("Matched by Nome:", matchNome);
  console.log("No Match (New):", noMatch);

  await pool.end();
}

main();

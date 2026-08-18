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

  const val = (row: any, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  const matriculasNoArquivo = new Set<string>();
  const nomesNoArquivo = new Set<string>();

  for (const row of rows) {
    const mat = val(row, colMatricula);
    const nome = val(row, colNome);
    if (mat) matriculasNoArquivo.add(mat);
    if (nome) nomesNoArquivo.add(nome.toLowerCase().trim());
  }

  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, cpf, situacao, arquivo_morto FROM alunos;");
  const existentes = dbAlunosRes.rows;

  console.log("DB Total alunos:", existentes.length);

  let matchMatCount = 0;
  let matchNomeCount = 0;
  let bothMatch = 0;
  let neitherMatch = 0;

  for (const a of existentes) {
    const matInDb = a.matricula ? String(a.matricula).trim() : "";
    const nomeInDb = a.nome_completo ? String(a.nome_completo).toLowerCase().trim() : "";

    const matMatch = matInDb && matriculasNoArquivo.has(matInDb);
    const nomeMatch = nomeInDb && nomesNoArquivo.has(nomeInDb);

    if (matMatch) matchMatCount++;
    if (nomeMatch) matchNomeCount++;
    if (matMatch || nomeMatch) bothMatch++;
    else {
      neitherMatch++;
      if (neitherMatch <= 10) {
        console.log("DB Student NOT matched by matricula nor name:", { id: a.id, matInDb, nomeInDb: a.nome_completo, cpf: a.cpf });
      }
    }
  }

  console.log("\n=== MATCH SUMMARY FOR DB ALUNOS AGAINST EXCEL SETS ===");
  console.log("DB alunos matching matricula in file:", matchMatCount);
  console.log("DB alunos matching name in file:", matchNomeCount);
  console.log("DB alunos matching AT LEAST ONE (kept alive):", bothMatch);
  console.log("DB alunos matching NEITHER (marked as transferido):", neitherMatch);

  await pool.end();
}

main();

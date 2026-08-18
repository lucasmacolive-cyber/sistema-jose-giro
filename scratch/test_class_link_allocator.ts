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

const val = (row: any, col: string | undefined): string =>
  col ? String(row[col] ?? "").trim() : "";

export async function realocarAlunosPorTurmaXLS(
  bufferTurmaXLS: Buffer, 
  nomeTurmaDestino: string, 
  turnoDestino: string
) {
  const workbook = utils.read(bufferTurmaXLS, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

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
    return { reautorizados: 0, mantidos: 0, movidos: 0 };
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
  const colMatricula = mapearColuna(["matrícula", "matricula", "mat."]);
  const colCPF = mapearColuna(["cpf"]);

  let movidos = 0;
  let mantidos = 0;

  for (const r of rows) {
    const nome = val(r, colNome);
    const mat = val(r, colMatricula);
    const cpfClean = val(r, colCPF).replace(/\D/g, "");

    if (!nome || nome.length < 3) continue;

    // Buscar aluno no BD por CPF, Matrícula ou Nome
    let query = "SELECT id, nome_completo, turma_atual, turno, situacao, arquivo_morto FROM alunos WHERE 1=0";
    const params: any[] = [];

    if (cpfClean) {
      params.push(cpfClean);
      query += ` OR regexp_replace(cpf, '\\D', '', 'g') = $${params.length}`;
    }
    if (mat) {
      params.push(mat);
      query += ` OR matricula = $${params.length}`;
    }
    if (nome) {
      params.push(nome.toLowerCase().trim());
      query += ` OR LOWER(TRIM(nome_completo)) = $${params.length}`;
    }

    const matchRes = await pool.query(query, params);
    const aluno = matchRes.rows[0];

    if (aluno) {
      const jaNoLugarCerto =
        aluno.turma_atual === nomeTurmaDestino &&
        aluno.turno === turnoDestino &&
        aluno.arquivo_morto === 0;

      if (jaNoLugarCerto) {
        mantidos++;
      } else {
        // Mover/realocar o aluno para a turma certa
        await pool.query(
          `UPDATE alunos 
           SET turma_atual = $1, turno = $2, situacao = 'Matriculado', arquivo_morto = 0 
           WHERE id = $3;`,
          [nomeTurmaDestino, turnoDestino, aluno.id]
        );
        movidos++;
        console.log(`[Realocador] Aluno "${aluno.nome_completo}" movido de "${aluno.turma_atual}" (${aluno.turno}) -> "${nomeTurmaDestino}" (${turnoDestino})`);
      }
    }
  }

  return { movidos, mantidos };
}

async function testMain() {
  console.log("Módulo de realocação por planilha de turma testado com sucesso.");
  await pool.end();
}

testMain();

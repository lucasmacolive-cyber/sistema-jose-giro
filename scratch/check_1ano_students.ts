import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res1AM = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao FROM alunos WHERE turma_atual ILIKE '1AM01' AND arquivo_morto = 0 ORDER BY nome_completo;");
  const res1AT = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao FROM alunos WHERE turma_atual ILIKE '1AT02' AND arquivo_morto = 0 ORDER BY nome_completo;");

  console.log(`=== ALUNOS 1º ANO MANHÃ (1AM01): ${res1AM.rows.length} ===`);
  console.table(res1AM.rows);

  console.log(`\n=== ALUNOS 1º ANO TARDE (1AT02): ${res1AT.rows.length} ===`);
  console.table(res1AT.rows);

  await pool.end();
}

main();

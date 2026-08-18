import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, nome_completo, turma_atual, turno, situacao FROM alunos WHERE nome_completo ILIKE '%AYLA OHANNA%';");
  console.log("Ayla in DB:", res.rows);
  await pool.end();
}

main();

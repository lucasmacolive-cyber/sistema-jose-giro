import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function cleanup() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pool.query("DELETE FROM alunos WHERE nome_completo ILIKE '%Teste Ficticio%';");
  const res = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0;");
  console.log(`Alunos ATIVOS limpos no BD: ${res.rows[0].count}`);

  await pool.end();
}

cleanup();

import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const total = await pool.query("SELECT COUNT(*) FROM alunos;");
    const totalVivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0 OR arquivo_morto IS NULL;");
    const totalMortos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 1;");

    console.log("=== DB STATS ===");
    console.log("Total Alunos in DB:", total.rows[0].count);
    console.log("Total Alunos arquivo_morto = 0 or null:", totalVivos.rows[0].count);
    console.log("Total Alunos arquivo_morto = 1:", totalMortos.rows[0].count);

    const situacoes = await pool.query("SELECT situacao, arquivo_morto, COUNT(*) as qty FROM alunos GROUP BY situacao, arquivo_morto ORDER BY qty DESC;");
    console.log("Situacoes distribution:", situacoes.rows);

    const sampleAlunos = await pool.query("SELECT id, nome_completo, turma_atual, situacao, arquivo_morto FROM alunos LIMIT 10;");
    console.log("Sample alunos:", sampleAlunos.rows);

    const syncStatus = await pool.query("SELECT * FROM sync_status ORDER BY id DESC LIMIT 5;");
    console.log("Recent sync_status logs:", syncStatus.rows);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Error querying DB:", err);
    process.exit(1);
  }
}

main();

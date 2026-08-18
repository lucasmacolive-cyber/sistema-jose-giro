import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const total = await pool.query("SELECT COUNT(*) FROM alunos;");
  const vivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0 OR arquivo_morto IS NULL;");
  const mortos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 1;");
  const sit = await pool.query("SELECT situacao, arquivo_morto, COUNT(*) as qty FROM alunos GROUP BY situacao, arquivo_morto;");
  const syncLogs = await pool.query("SELECT id, status, mensagem, total_alunos, ultima_sync FROM sync_status ORDER BY id DESC LIMIT 5;");

  console.log("=== RESUMO BANCO DE DADOS ===");
  console.log("Total total de registros na tabela alunos:", total.rows[0].count);
  console.log("Alunos Vivos (arquivo_morto = 0):", vivos.rows[0].count);
  console.log("Alunos Arquivado/Morto (arquivo_morto = 1):", mortos.rows[0].count);
  console.log("\nDistribution por situação e arquivo_morto:");
  console.table(sit.rows);
  console.log("\nÚltimas Sincronizações (sync_status):");
  console.table(syncLogs.rows);

  await pool.end();
}

main();

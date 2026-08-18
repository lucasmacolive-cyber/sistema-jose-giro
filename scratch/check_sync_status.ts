import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query("SELECT id, status, mensagem, total_alunos, ultima_sync FROM sync_status ORDER BY id DESC LIMIT 5;");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main();

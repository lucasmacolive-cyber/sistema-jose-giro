import pg from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), "..", "..", ".env") });

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Adicionando coluna detalhes em sync_status...");
    await pool.query("ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS detalhes TEXT;");
    console.log("Coluna detalhes adicionada com sucesso!");
  } catch (err) {
    console.error("Erro ao adicionar coluna:", err);
  } finally {
    await pool.end();
  }
}

run();

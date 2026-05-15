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
    console.log("Adicionando coluna arquivo_conteudo...");
    await pool.query("ALTER TABLE impressoes ADD COLUMN IF NOT EXISTS arquivo_conteudo TEXT;");
    console.log("Coluna adicionada com sucesso!");
  } catch (err) {
    console.error("Erro ao adicionar coluna:", err);
  } finally {
    await pool.end();
  }
}

run();

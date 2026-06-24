// @ts-nocheck
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: "../../.env" });

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query("SELECT chave, SUBSTRING(valor, 1, 100) as val_short, atualizado_em FROM configuracoes");
  console.log("=== ALL CONFIGS WITH TIMESTAMPS ===");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

check().catch(console.error);

import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: "../../.env" });

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'");
  console.log("Colunas na tabela usuarios:", res.rows.map(r => r.column_name));
  await pool.end();
}

check().catch(console.error);

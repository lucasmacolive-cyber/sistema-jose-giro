const pg = require("pg");
const { Pool } = pg;

async function run() {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_38zmkQOytTZL@ep-gentle-cherry-a4tx391j-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  });

  const number = "5522981310965";
  console.log("Setting whatsapp_number to:", number);
  
  await pool.query(
    `INSERT INTO configuracoes (chave, valor, atualizado_em) 
     VALUES ('whatsapp_number', $1, NOW())
     ON CONFLICT (chave) DO UPDATE SET valor = $1, atualizado_em = NOW()`,
    [number]
  );
  
  console.log("Database updated successfully.");
  await pool.end();
}

run().catch(console.error);

const pg = require("pg");
const { Pool } = pg;

async function check() {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_38zmkQOytTZL@ep-gentle-cherry-a4tx391j-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query("SELECT valor, atualizado_em FROM configuracoes WHERE chave = 'whatsapp_pairing_code'");
  if (res.rows.length > 0) {
    console.log("Found pairing code:", res.rows[0].valor, "updated at:", res.rows[0].atualizado_em);
  } else {
    console.log("No whatsapp_pairing_code found in DB.");
  }
  
  const ready = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_ready'");
  console.log("whatsapp_ready status:", ready.rows[0]?.valor);
  
  await pool.end();
}

check().catch(console.error);

const pg = require("pg");
const { Pool } = pg;

async function check() {
  const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_38zmkQOytTZL@ep-gentle-cherry-a4tx391j-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'baileys_creds'");
  if (res.rows.length > 0) {
    const creds = JSON.parse(res.rows[0].valor);
    console.log("Registered status:", creds.registered);
    console.log("Creds keys:", Object.keys(creds));
  } else {
    console.log("No baileys_creds found.");
  }
  await pool.end();
}

check().catch(console.error);

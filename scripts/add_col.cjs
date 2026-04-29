const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Adicionando coluna impressora_nome...");
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE impressoes ADD COLUMN IF NOT EXISTS impressora_nome varchar(50)');
    console.log("Sucesso!");
  } catch (err) {
    console.error("Erro:", err);
  } finally {
    client.release();
  }
  process.exit(0);
}

main();

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("ALTER TABLE diario_aulas ADD COLUMN tipo VARCHAR(20) DEFAULT 'normal'")
  .then(() => { console.log('Column added'); process.exit(0); })
  .catch(e => { console.log(e.message); process.exit(0); });

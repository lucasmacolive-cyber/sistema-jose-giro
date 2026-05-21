const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado ao banco de dados!");
    const res = await client.query('SELECT * FROM usuarios LIMIT 5');
    console.log("Usuários cadastrados:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Erro ao conectar ou consultar:", err);
  } finally {
    await client.end();
  }
}

run();

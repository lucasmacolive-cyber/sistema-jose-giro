const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("=== TURNOS DAS TURMAS ===");
    const resTurnos = await client.query('SELECT DISTINCT turno, COUNT(*) FROM turmas GROUP BY turno');
    console.log(resTurnos.rows);

    console.log("\n=== TODAS AS TURMAS ===");
    const resTurmas = await client.query('SELECT id, nome_turma, turno FROM turmas ORDER BY nome_turma');
    console.log(resTurmas.rows);

    console.log("\n=== PROFESSORES COM SUAS TURMAS ===");
    const resProfs = await client.query('SELECT id, nome, turma_manha, turma_tarde, turno FROM professores ORDER BY nome');
    console.log(resProfs.rows);

  } catch (err) {
    console.error("Erro ao conectar ou consultar:", err);
  } finally {
    await client.end();
  }
}

run();

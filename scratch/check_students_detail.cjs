const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT id, nome_completo, situacao, arquivo_morto, motivo_saida, data_saida, turma_atual FROM alunos LIMIT 20");
  console.log("Amostra de 20 alunos:", res.rows);

  const resMotivos = await client.query("SELECT motivo_saida, count(*) FROM alunos GROUP BY motivo_saida");
  console.log("Contagem por motivo_saida:", resMotivos.rows);

  const resTurmasAlunos = await client.query("SELECT turma_atual, count(*) FROM alunos GROUP BY turma_atual ORDER BY count DESC");
  console.log("Alunos por turma_atual:", resTurmasAlunos.rows);

  await client.end();
}

main().catch(console.error);

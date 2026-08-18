const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("=== ANÁLISE COMPLETA DOS ALUNOS NO BANCO ===");

  // 1. Total de registros na tabela alunos
  const resTotal = await client.query("SELECT COUNT(*) FROM alunos");
  console.log("\n1. Total de linhas na tabela 'alunos':", resTotal.rows[0].count);

  // 2. Agrupado por arquivo_morto
  const resArquivoMorto = await client.query("SELECT arquivo_morto, COUNT(*) FROM alunos GROUP BY arquivo_morto");
  console.log("\n2. Distribuição por 'arquivo_morto':", resArquivoMorto.rows);

  // 3. Agrupado por situacao
  const resSituacao = await client.query("SELECT situacao, COUNT(*) FROM alunos GROUP BY situacao ORDER BY count DESC");
  console.log("\n3. Distribuição por 'situacao':", resSituacao.rows);

  // 4. Cruzamento arquivo_morto x situacao
  const resCruzamento = await client.query("SELECT arquivo_morto, situacao, COUNT(*) FROM alunos GROUP BY arquivo_morto, situacao ORDER BY arquivo_morto, count DESC");
  console.log("\n4. Cruzamento (arquivo_morto x situacao):", resCruzamento.rows);

  // 5. Total Ativos na Dashboard (arquivo_morto = 0 AND situacao = 'Matriculado')
  const resDashboard = await client.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0 AND situacao = 'Matriculado'");
  console.log("\n5. O que a DASHBOARD conta como 'Total de Alunos':", resDashboard.rows[0].count);

  // 6. Total na tela de Alunos (arquivo_morto = 0)
  const resTelaAlunos = await client.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0");
  console.log("\n6. O que a tela ALUNOS (GET /api/alunos) lista por padrão:", resTelaAlunos.rows[0].count);

  // 7. Agrupamento por Turma (para alunos com arquivo_morto = 0)
  const resTurmas = await client.query(`
    SELECT turma_atual, situacao, COUNT(*) 
    FROM alunos 
    WHERE arquivo_morto = 0 
    GROUP BY turma_atual, situacao 
    ORDER BY turma_atual, situacao
  `);
  console.log("\n7. Alunos ativos por Turma e Situação:", resTurmas.rows);

  // 8. Alunos com turma_atual nula ou vazia
  const resSemTurma = await client.query("SELECT id, nome_completo, situacao, arquivo_morto FROM alunos WHERE turma_atual IS NULL OR turma_atual = ''");
  console.log("\n8. Alunos sem turma definida:", resSemTurma.rows);

  // 9. Nomes duplicados
  const resDupes = await client.query("SELECT nome_completo, COUNT(*) FROM alunos GROUP BY nome_completo HAVING COUNT(*) > 1");
  console.log("\n9. Alunos com nomes exatamente iguais:", resDupes.rows);

  await client.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});

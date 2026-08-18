import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const totalRes = await pool.query("SELECT COUNT(*) FROM alunos;");
  const ativosRes = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0;");
  const mortosRes = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 1;");
  
  console.log(`Total de alunos no banco: ${totalRes.rows[0].count}`);
  console.log(`Alunos ATIVOS (arquivo_morto = 0): ${ativosRes.rows[0].count}`);
  console.log(`Alunos ARQUIVADOS (arquivo_morto = 1): ${mortosRes.rows[0].count}`);

  const turmasRes = await pool.query(`
    SELECT turma_atual, turno, COUNT(*) as qtd 
    FROM alunos 
    WHERE arquivo_morto = 0 
    GROUP BY turma_atual, turno 
    ORDER BY turma_atual;
  `);

  console.log("\nAlunos ATIVOS por Turma e Turno:");
  console.table(turmasRes.rows);

  const transferidosRecentes = await pool.query(`
    SELECT id, nome_completo, turma_atual, situacao, motivo_saida, data_saida 
    FROM alunos 
    WHERE arquivo_morto = 1 
    ORDER BY id DESC 
    LIMIT 20;
  `);

  console.log("\nÚltimos 20 alunos ARQUIVADOS:");
  console.table(transferidosRecentes.rows);

  await pool.end();
}

main();

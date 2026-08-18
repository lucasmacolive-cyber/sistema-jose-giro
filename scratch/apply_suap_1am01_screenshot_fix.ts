import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("=== APLICANDO ATUALIZAÇÃO DA TURMA 1º ANO MANHÃ CONFORME FOTO DO SUAP ===\n");

  // 1. ELOA NETO BENTO -> Transferida para 1AM01 (Manhã)
  await pool.query(`
    UPDATE alunos 
    SET turma_atual = '1AM01', turno = 'Manhã', situacao = 'Matriculado', arquivo_morto = 0 
    WHERE matricula = '20261031610007' OR nome_completo ILIKE '%ELOA NETO BENTO%';
  `);
  console.log("✓ ELOA NETO BENTO atualizada para 1AM01 (Manhã) - Matriculado");

  // 2. Luíza santos de Souza -> Reativada em 1AM01 (Manhã)
  await pool.query(`
    UPDATE alunos 
    SET turma_atual = '1AM01', turno = 'Manhã', situacao = 'Matriculado', arquivo_morto = 0 
    WHERE matricula = '20261031610046' OR nome_completo ILIKE '%Luíza santos de Souza%';
  `);
  console.log("✓ Luíza santos de Souza reativada em 1AM01 (Manhã) - Matriculado");

  // 3. Vallentyna Pereira Domingues Pinheiro -> Transferida
  await pool.query(`
    UPDATE alunos 
    SET situacao = 'Transferido', arquivo_morto = 1, motivo_saida = 'Transferido no SUAP' 
    WHERE matricula = '20261031610035' OR nome_completo ILIKE '%Vallentyna Pereira Domingues%';
  `);
  console.log("✓ Vallentyna Pereira Domingues Pinheiro atualizada para Transferido");

  // 4. Garantir que os demais transferidos do diário da foto estejam com arquivo_morto = 1
  const transferidosFoto = [
    "20261031610003", // ANNA JULIA LIMA DE SOUZA
    "20261031610006", // CHRISTHOPHER DO COUTO BERNARDO SANTANA
    "20261031610010", // ISIS EMANUELLY SANTANA DE AGUIAR
    "20261031610011", // KEYLLOR GOMES RANGEL
  ];

  for (const mat of transferidosFoto) {
    await pool.query(`
      UPDATE alunos 
      SET situacao = 'Transferido', arquivo_morto = 1, motivo_saida = 'Transferido no SUAP' 
      WHERE matricula = $1;
    `, [mat]);
  }

  console.log("\n=== LISTAGEM FINAL DE ALUNOS ATIVOS NO 1º ANO MANHÃ (1AM01) ===");
  const res1AM = await pool.query(`
    SELECT id, matricula, nome_completo, turma_atual, turno, situacao 
    FROM alunos 
    WHERE turma_atual = '1AM01' AND arquivo_morto = 0 
    ORDER BY nome_completo;
  `);
  console.table(res1AM.rows);

  console.log(`Total de alunos ATIVOS na turma 1AM01 no BD: ${res1AM.rows.length}`);

  await pool.end();
}

main();

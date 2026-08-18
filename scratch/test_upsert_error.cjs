const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // Check unique constraints on alunos table
  const resConstraints = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'alunos'::regclass
  `);
  console.log("Constraints na tabela alunos:", resConstraints.rows);

  // Check duplicate matriculas in DB
  const resDupes = await client.query(`
    SELECT matricula, count(*) 
    FROM alunos 
    WHERE matricula IS NOT NULL AND matricula != '' 
    GROUP BY matricula 
    HAVING count(*) > 1
  `);
  console.log("Matrículas duplicadas no banco:", resDupes.rows);

  // Test updating Akilla directly
  const resAkilla = await client.query(`
    UPDATE alunos 
    SET arquivo_morto = 0, situacao = 'Matriculado', turma_atual = '1AM01' 
    WHERE matricula = '20261031610002' OR nome_completo ILIKE '%AKILLA%'
  `);
  console.log("Resultado update direto Akilla:", resAkilla.rowCount);

  await client.end();
}

main().catch(console.error);

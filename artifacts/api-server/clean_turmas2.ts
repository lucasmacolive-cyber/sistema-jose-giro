import { db, turmasTable, alunosTable } from './src/lib/db/index.js';
import { sql, eq, and } from 'drizzle-orm';

async function run() {
  const turmas = await db.select().from(turmasTable);
  console.log(`Encontradas ${turmas.length} turmas na tabela.`);
  for (const t of turmas) {
    const result = await db.select({count: sql<number>`count(*)`})
                         .from(alunosTable)
                         .where(and(
                           eq(alunosTable.turmaAtual, t.nomeTurma), 
                           eq(alunosTable.arquivoMorto, 0)
                         ));
    const qtd = Number(result[0].count);
    if (qtd === 0) {
      console.log(`Deletando turma vazia (sem alunos ativos): ${t.nomeTurma} (ID: ${t.id})`);
      await db.delete(turmasTable).where(eq(turmasTable.id, t.id));
    } else {
      console.log(`Mantendo turma com alunos ativos: ${t.nomeTurma} (Alunos Ativos: ${qtd})`);
    }
  }
  process.exit(0);
}

run();

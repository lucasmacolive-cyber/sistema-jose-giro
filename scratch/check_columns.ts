import { db, turmasTable, alunosTable } from "../api/lib/db/index.ts";
import { eq, and, sql } from "drizzle-orm";

async function run() {
  const turmas = await db.select().from(turmasTable).orderBy(turmasTable.nomeTurma);
  console.log(`Found ${turmas.length} turmas:`);

  const turmasComCount = await Promise.all(
    turmas.map(async (turma) => {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(alunosTable)
        .where(and(eq(alunosTable.turmaAtual, turma.nomeTurma), eq(alunosTable.arquivoMorto, 0)));
      
      return {
        id: turma.id,
        nomeTurma: turma.nomeTurma,
        turno: turma.turno,
        linkSuap: turma.linkSuap,
        linkSuapAlunos: turma.linkSuapAlunos,
        totalAlunos: Number(result[0]?.count ?? 0)
      };
    })
  );

  console.log(turmasComCount);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

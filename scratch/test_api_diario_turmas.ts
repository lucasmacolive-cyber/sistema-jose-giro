import { db, turmasTable, alunos as alunosTable, professoresTable } from "../api/lib/db/index.ts";
import { eq, sql } from "drizzle-orm";

async function run() {
  try {
    const turmas = await db.select().from(turmasTable).orderBy(turmasTable.nomeTurma);
    console.log("Total turmas:", turmas.length);
    
    const alunosCounts = await db
      .select({ turmaAtual: alunosTable.turmaAtual, total: sql<number>`count(*)::int` })
      .from(alunosTable)
      .where(eq(alunosTable.situacao, "Matriculado"))
      .groupBy(alunosTable.turmaAtual);
      
    console.log("Alunos counts groups:", alunosCounts.length);

    const countMap: Record<string, number> = {};
    for (const r of alunosCounts) {
      if (r.turmaAtual) countMap[r.turmaAtual] = r.total;
    }

    const profs = await db.select().from(professoresTable);
    const profsMap: Record<string, string> = {};
    for (const p of profs) {
      if (p.turmaManha) profsMap[p.turmaManha] = profsMap[p.turmaManha] ? profsMap[p.turmaManha] + ", " + p.nome : p.nome;
      if (p.turmaTarde) profsMap[p.turmaTarde] = profsMap[p.turmaTarde] ? profsMap[p.turmaTarde] + ", " + p.nome : p.nome;
    }

    const result = turmas.map((t) => ({
      ...t,
      professorResponsavel: profsMap[t.nomeTurma] || t.professorResponsavel,
      totalAlunos: countMap[t.nomeTurma] ?? 0,
    })).filter(t => t.totalAlunos > 0);

    console.log("Resultado final turmas filtradas (totalAlunos > 0):", result.length);
    if (result.length > 0) {
      console.log("Primeiros 3 resultados:", result.slice(0, 3));
    }
  } catch (e: any) {
    console.error("Erro no mock do endpoint:", e.message);
  }
}
run();

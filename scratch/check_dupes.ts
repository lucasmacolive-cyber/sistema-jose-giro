import { db } from "../lib/db/src/index.js";
import { alunosTable, turmasTable } from "../lib/db/src/schema/index.js";
import { inArray } from "drizzle-orm";

async function run() {
  const turmas = await db.select().from(turmasTable);
  const outOfStandardNames = turmas.filter(t => t.nomeTurma.includes(".") || t.nomeTurma === "-").map(t => t.nomeTurma);
  
  const allAlunos = await db.select().from(alunosTable);
  const alunosInOutOfStandard = allAlunos.filter(a => outOfStandardNames.includes(a.turmaAtual));

  const countsByName = {};
  for (const a of allAlunos) {
    const nomeNorm = a.nomeCompleto.trim().toUpperCase();
    countsByName[nomeNorm] = (countsByName[nomeNorm] || 0) + 1;
  }
  
  let dupesInOutOfStandard = 0;
  for (const a of alunosInOutOfStandard) {
    const nomeNorm = a.nomeCompleto.trim().toUpperCase();
    if (countsByName[nomeNorm] > 1) {
      dupesInOutOfStandard++;
    }
  }

  console.log(`Total students in out-of-standard turmas: ${alunosInOutOfStandard.length}`);
  console.log(`How many of those are duplicates in the system? ${dupesInOutOfStandard}`);

  process.exit(0);
}

run().catch(console.error);

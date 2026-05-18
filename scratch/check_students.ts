import { db } from "../lib/db/src/index.js";
import { alunosTable, turmasTable } from "../lib/db/src/schema/index.js";
import { eq, sql, inArray } from "drizzle-orm";

async function run() {
  const turmas = await db.select().from(turmasTable);
  const outOfStandard = turmas.filter(t => t.nomeTurma.includes(".") || t.nomeTurma === "-");
  const outOfStandardNames = outOfStandard.map(t => t.nomeTurma);
  
  const alunosInOutOfStandard = await db.select().from(alunosTable).where(inArray(alunosTable.turmaAtual, outOfStandardNames));
  console.log(`Found ${alunosInOutOfStandard.length} students currently assigned to out-of-standard turmas.`);

  process.exit(0);
}

run().catch(console.error);

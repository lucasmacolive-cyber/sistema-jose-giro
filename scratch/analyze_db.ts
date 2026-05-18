import { db } from "../lib/db/src/index.js";
import { alunosTable, turmasTable } from "../lib/db/src/schema/index.js";
import { eq, sql, inArray } from "drizzle-orm";

async function run() {
  console.log("Analyzing turmas...");
  const turmas = await db.select().from(turmasTable);
  const outOfStandard = turmas.filter(t => t.nomeTurma.includes(".") || t.nomeTurma === "-");
  console.log(`Found ${outOfStandard.length} out-of-standard turmas:`);
  console.log(outOfStandard.map(t => t.nomeTurma).join(", "));

  console.log("\nAnalyzing alunos for duplicates...");
  const allAlunos = await db.select().from(alunosTable);
  
  const countsByCPF = {};
  const countsByName = {};
  
  for (const a of allAlunos) {
    if (a.cpf && a.cpf.trim() !== "") {
      countsByCPF[a.cpf] = (countsByCPF[a.cpf] || 0) + 1;
    }
    const nomeNorm = a.nomeCompleto.trim().toUpperCase();
    countsByName[nomeNorm] = (countsByName[nomeNorm] || 0) + 1;
  }
  
  const duplicateCPFs = Object.entries(countsByCPF).filter(([_, count]) => count > 1);
  const duplicateNames = Object.entries(countsByName).filter(([_, count]) => count > 1);
  
  console.log(`Found ${duplicateCPFs.length} duplicate CPFs.`);
  console.log(`Found ${duplicateNames.length} duplicate Names.`);

  let totalDuplicatesToRemove = 0;
  for (const [name, count] of duplicateNames) {
    const dupes = allAlunos.filter(a => a.nomeCompleto.trim().toUpperCase() === name);
    // Keep the one with the most non-null/non-empty fields, or the most recent ID
    dupes.sort((a, b) => b.id - a.id);
    totalDuplicatesToRemove += dupes.length - 1;
  }
  
  console.log(`Total duplicate student records that can be removed: ${totalDuplicatesToRemove}`);

  process.exit(0);
}

run().catch(console.error);

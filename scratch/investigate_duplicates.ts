import { db } from "../lib/db/src/index.js";
import { alunosTable, turmasTable } from "../lib/db/src/schema/index.js";
import { eq, sql } from "drizzle-orm";

async function run() {
  console.log("Analyzing turmas...");
  const turmas = await db.select().from(turmasTable);
  console.log("Turmas found:", turmas.map(t => `${t.id}: ${t.nomeTurma}`).join(", "));

  console.log("\nAnalyzing alunos for duplicates...");
  // Group by some fields, probably nome, or maybe the system allows duplicates by name.
  // Wait, let's just get all alunos and count by name
  const allAlunos = await db.select().from(alunosTable);
  
  const countsByName = {};
  for (const a of allAlunos) {
    countsByName[a.nome] = (countsByName[a.nome] || 0) + 1;
  }
  
  const duplicates = Object.entries(countsByName).filter(([_, count]) => count > 1);
  console.log(`Found ${duplicates.length} duplicate names.`);
  
  for (const [name, count] of duplicates.slice(0, 10)) {
    console.log(`- ${name}: ${count} vezes`);
    const dupes = allAlunos.filter(a => a.nome === name);
    for (const d of dupes) {
      console.log(`   ID: ${d.id}, Turma: ${d.turmaId}, Matricula: ${d.matricula}, CPF: ${d.cpf}`);
    }
  }

  process.exit(0);
}

run().catch(console.error);

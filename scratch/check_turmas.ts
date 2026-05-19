import { db, turmasTable, alunosTable } from "../api/lib/db/index.ts";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== TURMAS NO BANCO DE DADOS ===");
  const allTurmas = await db.select().from(turmasTable);
  console.log(`Total de turmas cadastradas: ${allTurmas.length}`);
  
  for (const t of allTurmas) {
    const countRes = await db.select({ count: sql`count(*)` }).from(alunosTable).where(sql`turma_atual = ${t.nomeTurma}`);
    console.log(`- ID: ${t.id} | Nome: "${t.nomeTurma}" | Turno: ${t.turno} | Alunos: ${countRes[0].count}`);
  }
}

main().catch(console.error);

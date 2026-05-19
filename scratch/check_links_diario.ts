import "dotenv/config";
import { db, turmasTable } from "../api/lib/db/index.ts";

async function main() {
  const allTurmas = await db.select().from(turmasTable);
  const comLink = allTurmas.filter(t => t.linkSuap);
  const semLink = allTurmas.filter(t => !t.linkSuap);

  console.log("\n=== SITUAÇÃO DOS LINKS DE DIÁRIO ===");
  console.log(`✅ Com link cadastrado (${comLink.length}):`);
  for (const t of comLink) {
    console.log(`  - ${t.nomeTurma} (${t.turno}) → ${t.linkSuap}`);
  }
  console.log(`\n❌ SEM link cadastrado (${semLink.length}):`);
  for (const t of semLink) {
    console.log(`  - ${t.nomeTurma} (${t.turno})`);
  }
  console.log(`\nTotal de turmas: ${allTurmas.length} | Com link: ${comLink.length} | Sem link: ${semLink.length}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

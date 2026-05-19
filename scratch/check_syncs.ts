import { db, syncStatusTable } from "../api/lib/db/index.ts";
import { desc } from "drizzle-orm";

async function main() {
  console.log("=== RECENTES ATUALIZAÇÕES / SYNCS ===");
  const syncs = await db.select().from(syncStatusTable).orderBy(desc(syncStatusTable.id)).limit(5);
  
  for (const s of syncs) {
    console.log(`- ID: ${s.id} | Status: ${s.status} | Data: ${s.ultimaSync?.toLocaleString()} | Msg: "${s.mensagem}" | Total Alunos: ${s.totalAlunos}`);
  }
}

main().catch(console.error);

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const turmasTable = pgTable("turmas", {
  id: serial("id"),
  nomeTurma: text("nome_turma"),
  turno: text("turno"),
  linkSuap: text("link_suap"),
});

const db = drizzle(pool);

async function main() {
  const allTurmas = await db.select().from(turmasTable);
  const comLink = allTurmas.filter(t => t.linkSuap);
  const semLink = allTurmas.filter(t => !t.linkSuap);

  console.log("\n=== SITUACAO DOS LINKS DE DIARIO ===");
  console.log(`Com link cadastrado (${comLink.length}):`);
  for (const t of comLink) {
    console.log(`  - ${t.nomeTurma} (${t.turno}) -> ${t.linkSuap}`);
  }
  console.log(`\nSEM link cadastrado (${semLink.length}):`);
  for (const t of semLink) {
    console.log(`  - ${t.nomeTurma} (${t.turno})`);
  }
  console.log(`\nTotal: ${allTurmas.length} | Com link: ${comLink.length} | Sem link: ${semLink.length}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

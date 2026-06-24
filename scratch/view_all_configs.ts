import { db } from "../lib/db/src/index.js";
import { configuracoesTable } from "../lib/db/src/schema/configuracoes.js";

async function main() {
  try {
    const rows = await db.select().from(configuracoesTable);
    console.log("All configurations:");
    for (const r of rows) {
      console.log(`- ${r.chave}: ${r.valor.slice(0, 100)}`);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

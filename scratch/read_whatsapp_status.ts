import { db } from "../lib/db/src/index.js";
import { configuracoesTable } from "../lib/db/src/schema/configuracoes.js";
import { inArray } from "drizzle-orm";

async function main() {
  try {
    const keys = ["whatsapp_ready", "whatsapp_pairing_code", "whatsapp_number", "whatsapp_logs"];
    const rows = await db.select()
      .from(configuracoesTable)
      .where(inArray(configuracoesTable.chave, keys));
    
    console.log("WhatsApp status in DB:");
    for (const r of rows) {
      if (r.chave === "whatsapp_logs") {
        try {
          const logs = JSON.parse(r.valor);
          console.log(`- ${r.chave}: (Showing last 5 logs)`);
          logs.slice(-5).forEach((l: string) => console.log(`  > ${l}`));
        } catch {
          console.log(`- ${r.chave}: ${r.valor.slice(0, 100)}...`);
        }
      } else {
        console.log(`- ${r.chave}: ${r.valor}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

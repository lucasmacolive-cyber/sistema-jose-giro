import { db } from "../lib/db/src/index.js";
import { filaWhatsappTable } from "../lib/db/src/schema/fila-whatsapp.js";

async function main() {
  try {
    const rows = await db.select().from(filaWhatsappTable);
    console.log("Current Fila Whatsapp queue:");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

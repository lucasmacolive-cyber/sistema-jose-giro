import { db } from "../lib/db/src/index.js";
import { filaWhatsappTable } from "../lib/db/src/schema/fila-whatsapp.js";

async function main() {
  try {
    await db.update(filaWhatsappTable).set({
      status: "Pendente",
      erro: null,
      atualizadoEm: new Date(),
    });
    console.log("Successfully reset all messages in the queue to Pendente!");

    const rows = await db.select().from(filaWhatsappTable);
    console.log("Updated queue status:");
    console.log(JSON.stringify(rows.map(r => ({ id: r.id, numero: r.numero, status: r.status, erro: r.erro })), null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

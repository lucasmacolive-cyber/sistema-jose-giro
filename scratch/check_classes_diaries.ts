import { db } from "../lib/db/src/index.js";
import { diarioAulasTable } from "../lib/db/src/schema/diario.js";
import { isNotNull, eq } from "drizzle-orm";

async function main() {
  try {
    const filledDiaries = await db.select()
      .from(diarioAulasTable)
      .where(eq(diarioAulasTable.turmaNome, "1AT02"));
    
    console.log("Total diaries for 1AT02:", filledDiaries.length);
    const withContent = filledDiaries.filter(d => d.conteudo !== null && d.conteudo.trim() !== "");
    console.log("Diaries with content:", withContent.length);
    console.log("Diaries sample:", withContent.slice(0, 10));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

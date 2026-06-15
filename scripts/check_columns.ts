// @ts-nocheck
import { db } from "../lib/db/src";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fila_whatsapp'
    `);
    console.log("Colunas da tabela 'fila_whatsapp':");
    console.log(res.rows);

    const resConfig = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'configuracoes'
    `);
    console.log("\nColunas da tabela 'configuracoes':");
    console.log(resConfig.rows);

  } catch (err) {
    console.error("Erro ao verificar colunas:", err);
  }
  process.exit(0);
}

main();

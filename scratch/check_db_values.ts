// @ts-nocheck
import { db } from "../lib/db/src";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT chave, substring(valor from 1 for 50) as valor_preview FROM configuracoes
    `);
    console.log("Configurações no Banco:");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Erro ao ler banco de dados:", err);
  }
  process.exit(0);
}

main();

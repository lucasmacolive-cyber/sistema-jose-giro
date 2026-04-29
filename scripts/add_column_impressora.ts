import { db } from "../lib/db/src";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adicionando coluna impressora_nome à tabela impressoes...");
  try {
    await db.execute(sql`ALTER TABLE impressoes ADD COLUMN IF NOT EXISTS impressora_nome varchar(50)`);
    console.log("Coluna adicionada com sucesso!");
  } catch (err) {
    console.error("Erro ao adicionar coluna:", err);
  }
  process.exit(0);
}

main();

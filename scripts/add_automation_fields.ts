// @ts-nocheck
import { db } from "../lib/db/src";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adicionando novas colunas à tabela automatizacoes_whatsapp...");
  try {
    await db.execute(sql`
      ALTER TABLE automatizacoes_whatsapp 
      ADD COLUMN IF NOT EXISTS documento_escopo TEXT DEFAULT 'todas',
      ADD COLUMN IF NOT EXISTS documento_alvo TEXT,
      ADD COLUMN IF NOT EXISTS documento_mes TEXT DEFAULT 'atual',
      ADD COLUMN IF NOT EXISTS dias_mes TEXT
    `);
    console.log("Colunas adicionadas com sucesso!");
  } catch (err) {
    console.error("Erro ao adicionar colunas:", err);
  }
  process.exit(0);
}

main();

// @ts-nocheck
// Script para criar a tabela automatizacoes_whatsapp no banco de dados
import { db } from "../lib/db/src";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Criando tabela automatizacoes_whatsapp...");
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS automatizacoes_whatsapp (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo_documento TEXT NOT NULL DEFAULT 'mensagem',
        mensagem TEXT,
        arquivo_base64 TEXT,
        nome_arquivo TEXT,
        mimetype TEXT,
        frequencia TEXT NOT NULL DEFAULT 'unico',
        dias_semana TEXT,
        dia_mes INTEGER,
        horario TEXT NOT NULL DEFAULT '08:00',
        destinatario_tipo TEXT NOT NULL DEFAULT 'numero',
        destinatario_valor TEXT,
        ativa BOOLEAN NOT NULL DEFAULT true,
        ultima_execucao TIMESTAMP,
        proxima_execucao TIMESTAMP,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela automatizacoes_whatsapp criada com sucesso!");
  } catch (err) {
    console.error("Erro:", err);
  }
  process.exit(0);
}

main();

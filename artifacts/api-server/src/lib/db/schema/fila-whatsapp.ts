import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const filaWhatsappTable = pgTable("fila_whatsapp", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull(),
  mensagem: text("mensagem"),
  arquivoBase64: text("arquivo_base64"), // pode ser nulo se for só msg
  mimetype: text("mimetype"),
  nomeArquivo: text("nome_arquivo"),
  status: text("status").notNull().default("Pendente"), // Pendente, Enviado, Erro
  erro: text("erro"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

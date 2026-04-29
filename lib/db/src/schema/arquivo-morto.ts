import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const arquivoMorto = pgTable("arquivo_morto", {
  id: serial("id").primaryKey(),
  nomeAluno: varchar("nome_aluno", { length: 255 }).notNull(),
  matricula: varchar("matricula", { length: 50 }),
  anoSaida: varchar("ano_saida", { length: 10 }),
  turma: varchar("turma", { length: 50 }),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export const arquivoMortoDocumentos = pgTable("arquivo_morto_documentos", {
  id: serial("id").primaryKey(),
  arquivoMortoId: integer("arquivo_morto_id").notNull().references(() => arquivoMorto.id, { onDelete: "cascade" }),
  nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
  objectPath: text("object_path").notNull(),
  contentType: varchar("content_type", { length: 100 }).default("application/pdf"),
  tamanhoBytes: integer("tamanho_bytes"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

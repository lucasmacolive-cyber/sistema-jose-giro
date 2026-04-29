// @ts-nocheck
import { pgTable, text, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const configuracoesTable = pgTable("configuracoes", {
  id:           serial("id").primaryKey(),
  chave:        varchar("chave", { length: 100 }).unique().notNull(),
  valor:        text("valor"),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type Configuracao = typeof configuracoesTable.$inferSelect;

export const configuracoes = configuracoesTable;
import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const loginsExternos = pgTable("logins_externos", {
  id: serial("id").primaryKey(),
  nomeSite: varchar("nome_site", { length: 255 }).notNull(),
  url: text("url"),
  login: varchar("login", { length: 255 }).notNull(),
  senha: text("senha").notNull(),
  descricao: text("descricao"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

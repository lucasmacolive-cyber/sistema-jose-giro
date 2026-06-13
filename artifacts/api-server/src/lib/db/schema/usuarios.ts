// @ts-nocheck
import { pgTable, text, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nomeCompleto: text("nome_completo").notNull(),
  login: varchar("login", { length: 100 }).unique(),
  senha: text("senha").notNull(),
  perfil: varchar("perfil", { length: 20 }),
  foto: text("foto"),
  genero: varchar("genero", { length: 1 }),
});

export const insertUsuarioSchema = createInsertSchema(usuariosTable).omit({ id: true });
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuariosTable.$inferSelect;
export const usuarios = usuariosTable;

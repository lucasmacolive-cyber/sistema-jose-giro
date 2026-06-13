// @ts-nocheck
import { pgTable, text, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const funcionariosTable = pgTable("funcionarios", {
  id: serial("id").primaryKey(),
  nomeCompleto: text("nome_completo").notNull(),
  cpf: varchar("cpf", { length: 20 }),
  matricula: varchar("matricula", { length: 50 }),
  funcao: text("funcao"),
  turno: varchar("turno", { length: 20 }),
  telefoneContato: text("telefone_contato"),
  contatoEmergencia: text("contato_emergencia"),
  dataAdmissao: varchar("data_admissao", { length: 30 }),
  vinculo: varchar("vinculo", { length: 50 }),
  status: varchar("status", { length: 20 }),
  foto: text("foto"),
});

export const insertFuncionarioSchema = createInsertSchema(funcionariosTable).omit({ id: true });
export type InsertFuncionario = z.infer<typeof insertFuncionarioSchema>;
export type Funcionario = typeof funcionariosTable.$inferSelect;
export const funcionarios = funcionariosTable;

// @ts-nocheck
import { pgTable, text, serial, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professoresTable = pgTable("professores", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: varchar("cpf", { length: 20 }),
  matricula: varchar("matricula", { length: 30 }),
  turmaManha: varchar("turma_manha", { length: 20 }),
  turmaTarde: varchar("turma_tarde", { length: 20 }),
  turno: varchar("turno", { length: 20 }),
  telefone: varchar("telefone", { length: 30 }),
  vinculo: varchar("vinculo", { length: 100 }),
  email: text("email"),
  identificacaoCenso: varchar("identificacao_censo", { length: 30 }),
  dataNascimento: varchar("data_nascimento", { length: 20 }),
  foto: text("foto"),
  cargo: varchar("cargo", { length: 100 }),
  jornada: varchar("jornada", { length: 50 }),
  titulacao: varchar("titulacao", { length: 50 }),
}, (t) => [
  unique("professores_matricula_unique").on(t.matricula),
]);

export const insertProfessorSchema = createInsertSchema(professoresTable).omit({ id: true });
export type InsertProfessor = z.infer<typeof insertProfessorSchema>;
export type Professor = typeof professoresTable.$inferSelect;

export const professores = professoresTable;
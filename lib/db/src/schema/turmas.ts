import { pgTable, text, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const turmasTable = pgTable("turmas", {
  id: serial("id").primaryKey(),
  nomeTurma: varchar("nome_turma", { length: 50 }).notNull(),
  turno: varchar("turno", { length: 20 }),
  professorResponsavel: text("professor_responsavel"),
  profComplementador: text("prof_complementador"),
  profEducacaoFisica: text("prof_educacao_fisica"),
  auxiliarTurma: text("auxiliar_turma"),
  cor: varchar("cor", { length: 30 }).default("#3b82f6"),
  linkSuap: varchar("link_suap", { length: 255 }),
});

export const insertTurmaSchema = createInsertSchema(turmasTable).omit({ id: true });
export type InsertTurma = z.infer<typeof insertTurmaSchema>;
export type Turma = typeof turmasTable.$inferSelect;

export const turmas = turmasTable;
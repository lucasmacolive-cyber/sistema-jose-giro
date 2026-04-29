import { pgTable, serial, integer, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { alunosTable } from "./alunos";

export const presencasTable = pgTable("presencas", {
  id: serial("id").primaryKey(),
  alunoId: integer("aluno_id").references(() => alunosTable.id),
  bimestre: integer("bimestre"),
  disciplina: varchar("disciplina", { length: 100 }),
  totalAulas: integer("total_aulas").default(0),
  faltas: integer("faltas").default(0),
  percentualFrequencia: decimal("percentual_frequencia", { precision: 5, scale: 2 }),
  dataAtualizacao: timestamp("data_atualizacao").defaultNow(),
});

export const insertPresencaSchema = createInsertSchema(presencasTable).omit({ id: true });
export type InsertPresenca = z.infer<typeof insertPresencaSchema>;
export type Presenca = typeof presencasTable.$inferSelect;

export const presencas = presencasTable;
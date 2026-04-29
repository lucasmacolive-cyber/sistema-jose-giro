import { pgTable, serial, integer, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { alunosTable } from "./alunos";

export const notasTable = pgTable("notas", {
  id: serial("id").primaryKey(),
  alunoId: integer("aluno_id").references(() => alunosTable.id),
  bimestre: integer("bimestre"),
  disciplina: varchar("disciplina", { length: 100 }),
  nota1: decimal("nota_1", { precision: 5, scale: 2 }),
  nota2: decimal("nota_2", { precision: 5, scale: 2 }),
  notaFinal: decimal("nota_final", { precision: 5, scale: 2 }),
  mediaFinal: decimal("media_final", { precision: 5, scale: 2 }),
  situacao: varchar("situacao", { length: 30 }),
  dataAtualizacao: timestamp("data_atualizacao").defaultNow(),
});

export const insertNotaSchema = createInsertSchema(notasTable).omit({ id: true });
export type InsertNota = z.infer<typeof insertNotaSchema>;
export type Nota = typeof notasTable.$inferSelect;

export const notas = notasTable;
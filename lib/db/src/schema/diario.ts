import { pgTable, serial, integer, varchar, timestamp, uniqueIndex, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const diarioAulasTable = pgTable("diario_aulas", {
  id: serial("id").primaryKey(),
  turmaNome: varchar("turma_nome", { length: 50 }).notNull(),
  data: varchar("data", { length: 10 }).notNull(),
  numeroAulas: integer("numero_aulas").default(1),
  conteudo: text("conteudo"),
  criadoEm: timestamp("criado_em").defaultNow(),
}, (table) => [
  uniqueIndex("diario_aulas_turma_data_idx").on(table.turmaNome, table.data),
]);

export const diarioPresencasTable = pgTable("diario_presencas", {
  id: serial("id").primaryKey(),
  aulaId: integer("aula_id").references(() => diarioAulasTable.id, { onDelete: "cascade" }).notNull(),
  alunoId: integer("aluno_id").notNull(),
  status: varchar("status", { length: 1 }).notNull().default("P"),
}, (table) => [
  uniqueIndex("diario_presencas_aula_aluno_idx").on(table.aulaId, table.alunoId),
]);

export const insertDiarioAulaSchema = createInsertSchema(diarioAulasTable).omit({ id: true, criadoEm: true });
export type InsertDiarioAula = z.infer<typeof insertDiarioAulaSchema>;
export type DiarioAula = typeof diarioAulasTable.$inferSelect;

export const insertDiarioPresencaSchema = createInsertSchema(diarioPresencasTable).omit({ id: true });
export type InsertDiarioPresenca = z.infer<typeof insertDiarioPresencaSchema>;
export type DiarioPresenca = typeof diarioPresencasTable.$inferSelect;

export const diarioConfiguracoesTable = pgTable("diario_configuracoes", {
  id: serial("id").primaryKey(),
  chave: varchar("chave", { length: 100 }).unique().notNull(),
  valor: text("valor").notNull(),
});

export const diarioAulas = diarioAulasTable;
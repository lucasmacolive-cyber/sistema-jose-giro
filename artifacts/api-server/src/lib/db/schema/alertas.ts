// @ts-nocheck
import { pgTable, text, serial, varchar, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertasTable = pgTable("alertas", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  mensagem: text("mensagem").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
  lido: boolean("lido").default(false),
  dados: jsonb("dados"),
});

export const insertAlertaSchema = createInsertSchema(alertasTable).omit({ id: true, criadoEm: true });
export type InsertAlerta = z.infer<typeof insertAlertaSchema>;
export type Alerta = typeof alertasTable.$inferSelect;

export const alertas = alertasTable;
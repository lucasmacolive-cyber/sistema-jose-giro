import { pgTable, text, serial, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const syncStatusTable = pgTable("sync_status", {
  id: serial("id").primaryKey(),
  ultimaSync: timestamp("ultima_sync"),
  status: varchar("status", { length: 20 }).notNull().default("idle"),
  mensagem: text("mensagem"),
  totalAlunos: text("total_alunos"),
  totalRegistros: text("total_registros"),
});

export const insertSyncStatusSchema = createInsertSchema(syncStatusTable).omit({ id: true });
export type InsertSyncStatus = z.infer<typeof insertSyncStatusSchema>;
export type SyncStatus = typeof syncStatusTable.$inferSelect;

export const syncStatus = syncStatusTable;
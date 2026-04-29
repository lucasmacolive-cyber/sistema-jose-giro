// @ts-nocheck
import { pgTable, text, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const impressoesTable = pgTable("impressoes", {
  id: serial("id").primaryKey(),
  dataPedido: timestamp("data_pedido").defaultNow(),
  professorSolicitante: text("professor_solicitante").notNull(),
  linkArquivo: text("link_arquivo").notNull(),
  nomeArquivo: text("nome_arquivo"),
  tipoArquivo: varchar("tipo_arquivo", { length: 50 }),
  observacoes: text("observacoes"),
  quantidadeCopias: integer("quantidade_copias").notNull().default(1),
  duplex: boolean("duplex").default(false),
  dataParaUso: varchar("data_para_uso", { length: 30 }),
  horarioImpressao: varchar("horario_impressao", { length: 10 }),
  status: varchar("status", { length: 20 }).notNull().default("Pendente"),
  lido: boolean("lido").default(false),
  imprimiuEm: timestamp("imprimiu_em"),
  progresso: integer("progresso").default(0),
  mensagemStatus: text("mensagem_status"),
  colorida: boolean("colorida").default(false),
  impressoraNome: varchar("impressora_nome", { length: 50 }),
});

export const insertImpressaoSchema = createInsertSchema(impressoesTable).omit({ id: true, dataPedido: true });
export type InsertImpressao = z.infer<typeof insertImpressaoSchema>;
export type Impressao = typeof impressoesTable.$inferSelect;

export const impressoes = impressoesTable;
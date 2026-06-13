// @ts-nocheck
import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

export const professores = pgTable("professores", {
  id: serial("id").primaryKey().notNull(),
  nome: text("nome").notNull(),
  cpf: varchar("cpf", { length: 20 }),
  matricula: varchar("matricula", { length: 30 }).unique(),
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
});

export const funcionarios = pgTable("funcionarios", {
  id: serial("id").primaryKey().notNull(),
  nomeCompleto: text("nome_completo").notNull(),
  cpf: varchar("cpf", { length: 20 }),
  matricula: varchar("matricula", { length: 20 }),
  funcao: varchar("funcao", { length: 100 }),
  turno: varchar("turno", { length: 20 }),
  telefoneContato: varchar("telefone_contato", { length: 30 }),
  contatoEmergencia: varchar("contato_emergencia", { length: 30 }),
  dataAdmissao: varchar("data_admissao", { length: 20 }),
  vinculo: varchar("vinculo", { length: 50 }),
  status: varchar("status", { length: 20 }).default("Ativo"),
  foto: text("foto"),
});

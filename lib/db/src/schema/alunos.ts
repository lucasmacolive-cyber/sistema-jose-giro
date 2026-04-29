import { pgTable, text, serial, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alunosTable = pgTable("alunos", {
  id: serial("id").primaryKey(),
  matricula: varchar("matricula", { length: 50 }).unique(),
  nomeCompleto: text("nome_completo").notNull(),
  dataNascimento: varchar("data_nascimento", { length: 30 }),
  turmaAtual: varchar("turma_atual", { length: 50 }),
  turno: varchar("turno", { length: 20 }),
  nomeMae: text("nome_mae"),
  nomePai: text("nome_pai"),
  responsavel: text("responsavel"),
  telefone: text("telefone"),
  emailPessoal: text("email_pessoal"),
  emailResponsavel: text("email_responsavel"),
  endereco: text("endereco"),
  situacao: varchar("situacao", { length: 50 }),
  sexo: varchar("sexo", { length: 1 }),
  etnia: varchar("etnia", { length: 50 }),
  anoIngresso: varchar("ano_ingresso", { length: 10 }),
  nivelEnsino: text("nivel_ensino"),
  descricaoCurso: text("descricao_curso"),
  zonaResidencial: varchar("zona_residencial", { length: 20 }),
  cpf: varchar("cpf", { length: 20 }),
  cpfResponsavel: varchar("cpf_responsavel", { length: 20 }),
  rg: text("rg"),
  chaveResponsavel: varchar("chave_responsavel", { length: 20 }),
  emailGoogleClassroom: text("email_google_classroom"),
  anoPrevisaoConclusao: varchar("ano_previsao_conclusao", { length: 10 }),
  codigoCurso: varchar("codigo_curso", { length: 20 }),
  arquivoMorto: integer("arquivo_morto").default(0),
  motivoSaida: text("motivo_saida"),
  dataSaida: varchar("data_saida", { length: 30 }),
  dataTransferencia: varchar("data_transferencia", { length: 30 }),
  tipoTransferencia: varchar("tipo_transferencia", { length: 20 }),
  turmaDestino: varchar("turma_destino", { length: 50 }),
  turmaOrigem: varchar("turma_origem", { length: 50 }),
  naturalidade: varchar("naturalidade", { length: 120 }),
});

export const insertAlunoSchema = createInsertSchema(alunosTable).omit({ id: true });
export type InsertAluno = z.infer<typeof insertAlunoSchema>;
export type Aluno = typeof alunosTable.$inferSelect;
export const alunos = alunosTable;

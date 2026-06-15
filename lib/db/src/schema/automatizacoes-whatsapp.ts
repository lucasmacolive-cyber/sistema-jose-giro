// @ts-nocheck
import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const automatizacoesWhatsappTable = pgTable("automatizacoes_whatsapp", {
  id:               serial("id").primaryKey(),
  nome:             text("nome").notNull(),
  // tipo_documento: 'mensagem' | 'ficai' | 'freq_mensal' | 'resumo_turma' | 'pre_diario'
  tipoDocumento:    text("tipo_documento").notNull().default("mensagem"),
  mensagem:         text("mensagem"),
  arquivoBase64:    text("arquivo_base64"),
  nomeArquivo:      text("nome_arquivo"),
  mimetype:         text("mimetype"),
  // frequencia: 'unico' | 'diario' | 'semanal' | 'mensal'
  frequencia:       text("frequencia").notNull().default("unico"),
  diasSemana:       text("dias_semana"),   // ex: "1,3,5" para Seg,Qua,Sex
  diaMes:           integer("dia_mes"),    // 1-31 para mensal
  horario:          text("horario").notNull().default("08:00"),
  // destinatario_tipo: 'numero' | 'professor' | 'todos_professores' | 'grupo' | 'turma_alunos' | 'todos_alunos' | 'funcionarios'
  destinatarioTipo: text("destinatario_tipo").notNull().default("numero"),
  destinatarioValor: text("destinatario_valor"), // numero, id professor, nome turma, jid grupo
  ativa:            boolean("ativa").default(true).notNull(),
  ultimaExecucao:   timestamp("ultima_execucao"),
  proximaExecucao:  timestamp("proxima_execucao"),
  criadoEm:         timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm:     timestamp("atualizado_em").defaultNow().notNull(),
});

export type AutomatizacaoWhatsapp = typeof automatizacoesWhatsappTable.$inferSelect;
export const automatizacoesWhatsapp = automatizacoesWhatsappTable;

import { pgTable, unique, serial, text, varchar, timestamp, integer, boolean, jsonb, foreignKey, numeric, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const usuarios = pgTable("usuarios", {
	id: serial().primaryKey().notNull(),
	nomeCompleto: text("nome_completo").notNull(),
	login: varchar({ length: 100 }),
	senha: text().notNull(),
	perfil: varchar({ length: 50 }).default('Professor').notNull(),
	genero: varchar({ length: 1 }),
}, (table) => [
	unique("usuarios_login_unique").on(table.login),
]);

export const turmas = pgTable("turmas", {
	id: serial().primaryKey().notNull(),
	nomeTurma: varchar("nome_turma", { length: 50 }).notNull(),
	turno: varchar({ length: 20 }),
	professorResponsavel: text("professor_responsavel"),
	profComplementador: text("prof_complementador"),
	profEducacaoFisica: text("prof_educacao_fisica"),
	auxiliarTurma: text("auxiliar_turma"),
	cor: varchar({ length: 30 }).default('#3b82f6'),
});

export const professores = pgTable("professores", {
	id: serial().primaryKey().notNull(),
	nome: text().notNull(),
	cpf: varchar({ length: 20 }),
	matricula: varchar({ length: 30 }),
	turmaManha: varchar("turma_manha", { length: 20 }),
	turmaTarde: varchar("turma_tarde", { length: 20 }),
	turno: varchar({ length: 20 }),
	telefone: varchar({ length: 30 }),
	vinculo: varchar({ length: 100 }),
	email: text(),
	identificacaoCenso: varchar("identificacao_censo", { length: 30 }),
	dataNascimento: varchar("data_nascimento", { length: 20 }),
	foto: text(),
	cargo: varchar({ length: 100 }),
	jornada: varchar({ length: 50 }),
	titulacao: varchar({ length: 50 }),
}, (table) => [
	unique("professores_matricula_unique").on(table.matricula),
]);

export const funcionarios = pgTable("funcionarios", {
	id: serial().primaryKey().notNull(),
	nomeCompleto: text("nome_completo").notNull(),
	cpf: varchar({ length: 20 }),
	matricula: varchar({ length: 20 }),
	funcao: varchar({ length: 100 }),
	turno: varchar({ length: 20 }),
	telefoneContato: varchar("telefone_contato", { length: 30 }),
	contatoEmergencia: varchar("contato_emergencia", { length: 30 }),
	dataAdmissao: varchar("data_admissao", { length: 20 }),
	vinculo: varchar({ length: 50 }),
	status: varchar({ length: 20 }).default('Ativo'),
	foto: text(),
});

export const impressoes = pgTable("impressoes", {
	id: serial().primaryKey().notNull(),
	dataPedido: timestamp("data_pedido", { mode: 'string' }).defaultNow(),
	professorSolicitante: text("professor_solicitante").notNull(),
	linkArquivo: text("link_arquivo").notNull(),
	nomeArquivo: text("nome_arquivo"),
	tipoArquivo: varchar("tipo_arquivo", { length: 50 }),
	observacoes: text(),
	quantidadeCopias: integer("quantidade_copias").default(1).notNull(),
	duplex: boolean().default(false),
	dataParaUso: varchar("data_para_uso", { length: 30 }),
	horarioImpressao: varchar("horario_impressao", { length: 10 }),
	status: varchar({ length: 20 }).default('Pendente').notNull(),
	lido: boolean().default(false),
	imprimiuEm: timestamp("imprimiu_em", { mode: 'string' }),
});

export const alertas = pgTable("alertas", {
	id: serial().primaryKey().notNull(),
	tipo: varchar({ length: 50 }).notNull(),
	mensagem: text().notNull(),
	criadoEm: timestamp("criado_em", { mode: 'string' }).defaultNow(),
	lido: boolean().default(false),
	dados: jsonb(),
});

export const alunos = pgTable("alunos", {
	id: serial().primaryKey().notNull(),
	matricula: varchar({ length: 50 }),
	nomeCompleto: text("nome_completo").notNull(),
	dataNascimento: varchar("data_nascimento", { length: 30 }),
	turmaAtual: varchar("turma_atual", { length: 50 }),
	turno: varchar({ length: 20 }),
	nomeMae: text("nome_mae"),
	nomePai: text("nome_pai"),
	responsavel: text(),
	telefone: text(),
	emailPessoal: text("email_pessoal"),
	emailResponsavel: text("email_responsavel"),
	endereco: text(),
	situacao: varchar({ length: 50 }),
	sexo: varchar({ length: 1 }),
	etnia: varchar({ length: 50 }),
	anoIngresso: varchar("ano_ingresso", { length: 10 }),
	nivelEnsino: text("nivel_ensino"),
	descricaoCurso: text("descricao_curso"),
	zonaResidencial: varchar("zona_residencial", { length: 20 }),
	cpf: varchar({ length: 20 }),
	cpfResponsavel: varchar("cpf_responsavel", { length: 20 }),
	rg: text(),
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
	naturalidade: varchar({ length: 120 }),
}, (table) => [
	unique("alunos_matricula_unique").on(table.matricula),
]);

export const syncStatus = pgTable("sync_status", {
	id: serial().primaryKey().notNull(),
	ultimaSync: timestamp("ultima_sync", { mode: 'string' }),
	status: varchar({ length: 20 }).default('idle').notNull(),
	mensagem: text(),
	totalAlunos: text("total_alunos"),
	totalRegistros: text("total_registros"),
});

export const notas = pgTable("notas", {
	id: serial().primaryKey().notNull(),
	alunoId: integer("aluno_id"),
	bimestre: integer(),
	disciplina: varchar({ length: 100 }),
	nota1: numeric("nota_1", { precision: 5, scale:  2 }),
	nota2: numeric("nota_2", { precision: 5, scale:  2 }),
	notaFinal: numeric("nota_final", { precision: 5, scale:  2 }),
	mediaFinal: numeric("media_final", { precision: 5, scale:  2 }),
	situacao: varchar({ length: 30 }),
	dataAtualizacao: timestamp("data_atualizacao", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.alunoId],
			foreignColumns: [alunos.id],
			name: "notas_aluno_id_alunos_id_fk"
		}),
]);

export const arquivoMorto = pgTable("arquivo_morto", {
	id: serial().primaryKey().notNull(),
	nomeAluno: varchar("nome_aluno", { length: 255 }).notNull(),
	matricula: varchar({ length: 50 }),
	anoSaida: varchar("ano_saida", { length: 10 }),
	turma: varchar({ length: 50 }),
	observacoes: text(),
	criadoEm: timestamp("criado_em", { mode: 'string' }).defaultNow(),
	atualizadoEm: timestamp("atualizado_em", { mode: 'string' }).defaultNow(),
});

export const loginsExternos = pgTable("logins_externos", {
	id: serial().primaryKey().notNull(),
	nomeSite: varchar("nome_site", { length: 255 }).notNull(),
	url: text(),
	login: varchar({ length: 255 }).notNull(),
	senha: text().notNull(),
	descricao: text(),
	criadoEm: timestamp("criado_em", { mode: 'string' }).defaultNow(),
	atualizadoEm: timestamp("atualizado_em", { mode: 'string' }).defaultNow(),
});

export const diarioConfiguracoes = pgTable("diario_configuracoes", {
	id: serial().primaryKey().notNull(),
	chave: varchar({ length: 100 }).notNull(),
	valor: text().notNull(),
}, (table) => [
	unique("diario_configuracoes_chave_unique").on(table.chave),
]);

export const configuracoes = pgTable("configuracoes", {
	id: serial().primaryKey().notNull(),
	chave: varchar({ length: 100 }).notNull(),
	valor: text(),
	atualizadoEm: timestamp("atualizado_em", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("configuracoes_chave_unique").on(table.chave),
]);

export const presencas = pgTable("presencas", {
	id: serial().primaryKey().notNull(),
	alunoId: integer("aluno_id"),
	bimestre: integer(),
	disciplina: varchar({ length: 100 }),
	totalAulas: integer("total_aulas").default(0),
	faltas: integer().default(0),
	percentualFrequencia: numeric("percentual_frequencia", { precision: 5, scale:  2 }),
	dataAtualizacao: timestamp("data_atualizacao", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.alunoId],
			foreignColumns: [alunos.id],
			name: "presencas_aluno_id_alunos_id_fk"
		}),
]);

export const arquivoMortoDocumentos = pgTable("arquivo_morto_documentos", {
	id: serial().primaryKey().notNull(),
	arquivoMortoId: integer("arquivo_morto_id").notNull(),
	nomeArquivo: varchar("nome_arquivo", { length: 255 }).notNull(),
	objectPath: text("object_path").notNull(),
	contentType: varchar("content_type", { length: 100 }).default('application/pdf'),
	tamanhoBytes: integer("tamanho_bytes"),
	criadoEm: timestamp("criado_em", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.arquivoMortoId],
			foreignColumns: [arquivoMorto.id],
			name: "arquivo_morto_documentos_arquivo_morto_id_arquivo_morto_id_fk"
		}).onDelete("cascade"),
]);

export const diarioAulas = pgTable("diario_aulas", {
	id: serial().primaryKey().notNull(),
	turmaNome: varchar("turma_nome", { length: 50 }).notNull(),
	data: varchar({ length: 10 }).notNull(),
	numeroAulas: integer("numero_aulas").default(1),
	conteudo: text(),
	criadoEm: timestamp("criado_em", { mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("diario_aulas_turma_data_idx").using("btree", table.turmaNome.asc().nullsLast().op("text_ops"), table.data.asc().nullsLast().op("text_ops")),
]);

export const diarioPresencas = pgTable("diario_presencas", {
	id: serial().primaryKey().notNull(),
	aulaId: integer("aula_id").notNull(),
	alunoId: integer("aluno_id").notNull(),
	status: varchar({ length: 1 }).default('P').notNull(),
}, (table) => [
	uniqueIndex("diario_presencas_aula_aluno_idx").using("btree", table.aulaId.asc().nullsLast().op("int4_ops"), table.alunoId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.aulaId],
			foreignColumns: [diarioAulas.id],
			name: "diario_presencas_aula_id_diario_aulas_id_fk"
		}).onDelete("cascade"),
]);

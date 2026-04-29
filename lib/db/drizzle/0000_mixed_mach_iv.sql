-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_completo" text NOT NULL,
	"login" varchar(100),
	"senha" text NOT NULL,
	"perfil" varchar(50) DEFAULT 'Professor' NOT NULL,
	"genero" varchar(1),
	CONSTRAINT "usuarios_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "turmas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_turma" varchar(50) NOT NULL,
	"turno" varchar(20),
	"professor_responsavel" text,
	"prof_complementador" text,
	"prof_educacao_fisica" text,
	"auxiliar_turma" text,
	"cor" varchar(30) DEFAULT '#3b82f6'
);
--> statement-breakpoint
CREATE TABLE "professores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cpf" varchar(20),
	"matricula" varchar(30),
	"turma_manha" varchar(20),
	"turma_tarde" varchar(20),
	"turno" varchar(20),
	"telefone" varchar(30),
	"vinculo" varchar(100),
	"email" text,
	"identificacao_censo" varchar(30),
	"data_nascimento" varchar(20),
	"foto" text,
	"cargo" varchar(100),
	"jornada" varchar(50),
	"titulacao" varchar(50),
	CONSTRAINT "professores_matricula_unique" UNIQUE("matricula")
);
--> statement-breakpoint
CREATE TABLE "funcionarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_completo" text NOT NULL,
	"cpf" varchar(20),
	"matricula" varchar(20),
	"funcao" varchar(100),
	"turno" varchar(20),
	"telefone_contato" varchar(30),
	"contato_emergencia" varchar(30),
	"data_admissao" varchar(20),
	"vinculo" varchar(50),
	"status" varchar(20) DEFAULT 'Ativo',
	"foto" text
);
--> statement-breakpoint
CREATE TABLE "impressoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_pedido" timestamp DEFAULT now(),
	"professor_solicitante" text NOT NULL,
	"link_arquivo" text NOT NULL,
	"nome_arquivo" text,
	"tipo_arquivo" varchar(50),
	"observacoes" text,
	"quantidade_copias" integer DEFAULT 1 NOT NULL,
	"duplex" boolean DEFAULT false,
	"data_para_uso" varchar(30),
	"horario_impressao" varchar(10),
	"status" varchar(20) DEFAULT 'Pendente' NOT NULL,
	"lido" boolean DEFAULT false,
	"imprimiu_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"mensagem" text NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	"lido" boolean DEFAULT false,
	"dados" jsonb
);
--> statement-breakpoint
CREATE TABLE "alunos" (
	"id" serial PRIMARY KEY NOT NULL,
	"matricula" varchar(50),
	"nome_completo" text NOT NULL,
	"data_nascimento" varchar(30),
	"turma_atual" varchar(50),
	"turno" varchar(20),
	"nome_mae" text,
	"nome_pai" text,
	"responsavel" text,
	"telefone" text,
	"email_pessoal" text,
	"email_responsavel" text,
	"endereco" text,
	"situacao" varchar(50),
	"sexo" varchar(1),
	"etnia" varchar(50),
	"ano_ingresso" varchar(10),
	"nivel_ensino" text,
	"descricao_curso" text,
	"zona_residencial" varchar(20),
	"cpf" varchar(20),
	"cpf_responsavel" varchar(20),
	"rg" text,
	"chave_responsavel" varchar(20),
	"email_google_classroom" text,
	"ano_previsao_conclusao" varchar(10),
	"codigo_curso" varchar(20),
	"arquivo_morto" integer DEFAULT 0,
	"motivo_saida" text,
	"data_saida" varchar(30),
	"data_transferencia" varchar(30),
	"tipo_transferencia" varchar(20),
	"turma_destino" varchar(50),
	"turma_origem" varchar(50),
	"naturalidade" varchar(120),
	CONSTRAINT "alunos_matricula_unique" UNIQUE("matricula")
);
--> statement-breakpoint
CREATE TABLE "sync_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"ultima_sync" timestamp,
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"mensagem" text,
	"total_alunos" text,
	"total_registros" text
);
--> statement-breakpoint
CREATE TABLE "notas" (
	"id" serial PRIMARY KEY NOT NULL,
	"aluno_id" integer,
	"bimestre" integer,
	"disciplina" varchar(100),
	"nota_1" numeric(5, 2),
	"nota_2" numeric(5, 2),
	"nota_final" numeric(5, 2),
	"media_final" numeric(5, 2),
	"situacao" varchar(30),
	"data_atualizacao" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arquivo_morto" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_aluno" varchar(255) NOT NULL,
	"matricula" varchar(50),
	"ano_saida" varchar(10),
	"turma" varchar(50),
	"observacoes" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logins_externos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome_site" varchar(255) NOT NULL,
	"url" text,
	"login" varchar(255) NOT NULL,
	"senha" text NOT NULL,
	"descricao" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diario_configuracoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" varchar(100) NOT NULL,
	"valor" text NOT NULL,
	CONSTRAINT "diario_configuracoes_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"chave" varchar(100) NOT NULL,
	"valor" text,
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "configuracoes_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE "presencas" (
	"id" serial PRIMARY KEY NOT NULL,
	"aluno_id" integer,
	"bimestre" integer,
	"disciplina" varchar(100),
	"total_aulas" integer DEFAULT 0,
	"faltas" integer DEFAULT 0,
	"percentual_frequencia" numeric(5, 2),
	"data_atualizacao" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "arquivo_morto_documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"arquivo_morto_id" integer NOT NULL,
	"nome_arquivo" varchar(255) NOT NULL,
	"object_path" text NOT NULL,
	"content_type" varchar(100) DEFAULT 'application/pdf',
	"tamanho_bytes" integer,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diario_aulas" (
	"id" serial PRIMARY KEY NOT NULL,
	"turma_nome" varchar(50) NOT NULL,
	"data" varchar(10) NOT NULL,
	"numero_aulas" integer DEFAULT 1,
	"conteudo" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diario_presencas" (
	"id" serial PRIMARY KEY NOT NULL,
	"aula_id" integer NOT NULL,
	"aluno_id" integer NOT NULL,
	"status" varchar(1) DEFAULT 'P' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_aluno_id_alunos_id_fk" FOREIGN KEY ("aluno_id") REFERENCES "public"."alunos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivo_morto_documentos" ADD CONSTRAINT "arquivo_morto_documentos_arquivo_morto_id_arquivo_morto_id_fk" FOREIGN KEY ("arquivo_morto_id") REFERENCES "public"."arquivo_morto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diario_presencas" ADD CONSTRAINT "diario_presencas_aula_id_diario_aulas_id_fk" FOREIGN KEY ("aula_id") REFERENCES "public"."diario_aulas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "diario_aulas_turma_data_idx" ON "diario_aulas" USING btree ("turma_nome" text_ops,"data" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "diario_presencas_aula_aluno_idx" ON "diario_presencas" USING btree ("aula_id" int4_ops,"aluno_id" int4_ops);
*/
import { relations } from "drizzle-orm/relations";
import { alunos, notas, presencas, arquivoMorto, arquivoMortoDocumentos, diarioAulas, diarioPresencas } from "./schema";

export const notasRelations = relations(notas, ({one}) => ({
	aluno: one(alunos, {
		fields: [notas.alunoId],
		references: [alunos.id]
	}),
}));

export const alunosRelations = relations(alunos, ({many}) => ({
	notas: many(notas),
	presencas: many(presencas),
}));

export const presencasRelations = relations(presencas, ({one}) => ({
	aluno: one(alunos, {
		fields: [presencas.alunoId],
		references: [alunos.id]
	}),
}));

export const arquivoMortoDocumentosRelations = relations(arquivoMortoDocumentos, ({one}) => ({
	arquivoMorto: one(arquivoMorto, {
		fields: [arquivoMortoDocumentos.arquivoMortoId],
		references: [arquivoMorto.id]
	}),
}));

export const arquivoMortoRelations = relations(arquivoMorto, ({many}) => ({
	arquivoMortoDocumentos: many(arquivoMortoDocumentos),
}));

export const diarioPresencasRelations = relations(diarioPresencas, ({one}) => ({
	diarioAula: one(diarioAulas, {
		fields: [diarioPresencas.aulaId],
		references: [diarioAulas.id]
	}),
}));

export const diarioAulasRelations = relations(diarioAulas, ({many}) => ({
	diarioPresencas: many(diarioPresencas),
}));
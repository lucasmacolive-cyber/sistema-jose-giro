// @ts-nocheck
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, notasTable, presencasTable } from "./db/index.js";

export interface NotaSyncItem {
  alunoId: number;
  bimestre: number;
  disciplina: string;
  nota1: string | null;
  notaFinal: string | null;
  mediaFinal: string | null;
  situacao: string;
}

export interface PresencaBimestralSyncItem {
  alunoId: number;
  bimestre: number;
  disciplina: string;
  totalAulas: number;
  faltas: number;
  percentualFrequencia: string;
}

/**
 * Faz upsert em lote na tabela `notas` por (alunoId, bimestre, disciplina)
 * preservando `nota2` manual existente e removendo eventuais duplicatas vazias.
 */
export async function upsertNotasLote(items: NotaSyncItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const alunoIds = Array.from(new Set(items.map((i) => i.alunoId)));
  const disciplinas = Array.from(new Set(items.map((i) => i.disciplina)));

  const existentes = await db
    .select({
      id: notasTable.id,
      alunoId: notasTable.alunoId,
      bimestre: notasTable.bimestre,
      disciplina: notasTable.disciplina,
    })
    .from(notasTable)
    .where(and(inArray(notasTable.alunoId, alunoIds), inArray(notasTable.disciplina, disciplinas)));

  const mapaExistente = new Map<string, number>();
  for (const row of existentes) {
    const key = `${row.alunoId}:${row.bimestre}:${row.disciplina}`;
    if (!mapaExistente.has(key)) mapaExistente.set(key, row.id);
  }

  const paraInserir: any[] = [];
  const agora = new Date();

  for (const item of items) {
    const key = `${item.alunoId}:${item.bimestre}:${item.disciplina}`;
    const existingId = mapaExistente.get(key);
    if (existingId) {
      await db
        .update(notasTable)
        .set({
          nota1: item.nota1,
          notaFinal: item.notaFinal,
          mediaFinal: item.mediaFinal,
          situacao: item.situacao,
          dataAtualizacao: agora,
        })
        .where(eq(notasTable.id, existingId));
    } else {
      paraInserir.push({
        alunoId: item.alunoId,
        bimestre: item.bimestre,
        disciplina: item.disciplina,
        nota1: item.nota1,
        notaFinal: item.notaFinal,
        mediaFinal: item.mediaFinal,
        situacao: item.situacao,
        dataAtualizacao: agora,
      });
    }
  }

  for (let k = 0; k < paraInserir.length; k += 300) {
    await db.insert(notasTable).values(paraInserir.slice(k, k + 300));
  }

  return items.length;
}

/**
 * Faz upsert em lote na tabela `presencas` (resumo bimestral) por (alunoId, bimestre, disciplina).
 */
export async function upsertPresencasBimestraisLote(items: PresencaBimestralSyncItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const alunoIds = Array.from(new Set(items.map((i) => i.alunoId)));
  const disciplinas = Array.from(new Set(items.map((i) => i.disciplina)));

  const existentes = await db
    .select({
      id: presencasTable.id,
      alunoId: presencasTable.alunoId,
      bimestre: presencasTable.bimestre,
      disciplina: presencasTable.disciplina,
    })
    .from(presencasTable)
    .where(and(inArray(presencasTable.alunoId, alunoIds), inArray(presencasTable.disciplina, disciplinas)));

  const mapaExistente = new Map<string, number>();
  for (const row of existentes) {
    const key = `${row.alunoId}:${row.bimestre}:${row.disciplina}`;
    if (!mapaExistente.has(key)) mapaExistente.set(key, row.id);
  }

  const paraInserir: any[] = [];
  const agora = new Date();

  for (const item of items) {
    const key = `${item.alunoId}:${item.bimestre}:${item.disciplina}`;
    const existingId = mapaExistente.get(key);
    if (existingId) {
      await db
        .update(presencasTable)
        .set({
          totalAulas: item.totalAulas,
          faltas: item.faltas,
          percentualFrequencia: item.percentualFrequencia,
          dataAtualizacao: agora,
        })
        .where(eq(presencasTable.id, existingId));
    } else {
      paraInserir.push({
        alunoId: item.alunoId,
        bimestre: item.bimestre,
        disciplina: item.disciplina,
        totalAulas: item.totalAulas,
        faltas: item.faltas,
        percentualFrequencia: item.percentualFrequencia,
        dataAtualizacao: agora,
      });
    }
  }

  for (let k = 0; k < paraInserir.length; k += 300) {
    await db.insert(presencasTable).values(paraInserir.slice(k, k + 300));
  }

  return items.length;
}

/**
 * Remove linhas fantasma antigas (sem nota_1, nota_2 e nota_final) geradas para bimestres futuros.
 */
export async function limparNotasFantasmasDisciplina(alunoIds: number[], disciplina: string): Promise<void> {
  if (alunoIds.length === 0) return;
  await db
    .delete(notasTable)
    .where(
      and(
        inArray(notasTable.alunoId, alunoIds),
        eq(notasTable.disciplina, disciplina),
        isNull(notasTable.nota1),
        isNull(notasTable.nota2),
        isNull(notasTable.notaFinal)
      )
    );
}


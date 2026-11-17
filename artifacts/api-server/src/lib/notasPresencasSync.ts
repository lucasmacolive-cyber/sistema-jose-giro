// @ts-nocheck
import { and, inArray, isNull, eq } from "drizzle-orm";
import { db, pool, withDbRetry, notasTable, presencasTable } from "./db/index.js";

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

  // Deduplica por (alunoId, bimestre, disciplina) mantendo o último valor
  const dedupMap = new Map<string, NotaSyncItem>();
  for (const item of items) {
    dedupMap.set(`${item.alunoId}:${item.bimestre}:${item.disciplina}`, item);
  }
  const uniqueItems = Array.from(dedupMap.values());

  const alunoIds = Array.from(new Set(uniqueItems.map((i) => i.alunoId)));
  const disciplinas = Array.from(new Set(uniqueItems.map((i) => i.disciplina)));

  const existentes = await withDbRetry(
    () =>
      db
        .select({
          id: notasTable.id,
          alunoId: notasTable.alunoId,
          bimestre: notasTable.bimestre,
          disciplina: notasTable.disciplina,
        })
        .from(notasTable)
        .where(and(inArray(notasTable.alunoId, alunoIds), inArray(notasTable.disciplina, disciplinas))),
    "upsertNotasLote:select"
  );

  const mapaExistente = new Map<string, number>();
  for (const row of existentes) {
    const key = `${row.alunoId}:${row.bimestre}:${row.disciplina}`;
    if (!mapaExistente.has(key)) mapaExistente.set(key, row.id);
  }

  const paraAtualizar: Array<{ id: number; item: NotaSyncItem }> = [];
  const paraInserir: any[] = [];
  const agora = new Date();

  for (const item of uniqueItems) {
    const key = `${item.alunoId}:${item.bimestre}:${item.disciplina}`;
    const existingId = mapaExistente.get(key);
    if (existingId) {
      paraAtualizar.push({ id: existingId, item });
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

  for (let k = 0; k < paraAtualizar.length; k += 200) {
    const chunk = paraAtualizar.slice(k, k + 200);
    const params: any[] = [];
    const valuesSql = chunk
      .map(({ id, item }, idx) => {
        const base = idx * 6;
        params.push(id, item.nota1, item.notaFinal, item.mediaFinal, item.situacao, agora);
        return `($${base + 1}::int, $${base + 2}::numeric, $${base + 3}::numeric, $${base + 4}::numeric, $${base + 5}::varchar, $${base + 6}::timestamp)`;
      })
      .join(", ");

    await withDbRetry(
      () =>
        pool.query(
          `UPDATE "notas" AS n
           SET "nota_1" = v.nota_1::numeric(5,2),
               "nota_final" = v.nota_final::numeric(5,2),
               "media_final" = v.media_final::numeric(5,2),
               "situacao" = v.situacao::varchar(30),
               "data_atualizacao" = v.data_atualizacao
           FROM (VALUES ${valuesSql}) AS v(id, nota_1, nota_final, media_final, situacao, data_atualizacao)
           WHERE n."id" = v.id`,
          params
        ),
      "upsertNotasLote:update"
    );
  }

  for (let k = 0; k < paraInserir.length; k += 300) {
    const chunk = paraInserir.slice(k, k + 300);
    await withDbRetry(
      () => db.insert(notasTable).values(chunk),
      "upsertNotasLote:insert"
    );
  }

  return uniqueItems.length;
}

/**
 * Faz upsert em lote na tabela `presencas` (resumo bimestral) por (alunoId, bimestre, disciplina).
 */
export async function upsertPresencasBimestraisLote(items: PresencaBimestralSyncItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const dedupMap = new Map<string, PresencaBimestralSyncItem>();
  for (const item of items) {
    dedupMap.set(`${item.alunoId}:${item.bimestre}:${item.disciplina}`, item);
  }
  const uniqueItems = Array.from(dedupMap.values());

  const alunoIds = Array.from(new Set(uniqueItems.map((i) => i.alunoId)));
  const disciplinas = Array.from(new Set(uniqueItems.map((i) => i.disciplina)));

  const existentes = await withDbRetry(
    () =>
      db
        .select({
          id: presencasTable.id,
          alunoId: presencasTable.alunoId,
          bimestre: presencasTable.bimestre,
          disciplina: presencasTable.disciplina,
        })
        .from(presencasTable)
        .where(and(inArray(presencasTable.alunoId, alunoIds), inArray(presencasTable.disciplina, disciplinas))),
    "upsertPresencasBimestraisLote:select"
  );

  const mapaExistente = new Map<string, number>();
  for (const row of existentes) {
    const key = `${row.alunoId}:${row.bimestre}:${row.disciplina}`;
    if (!mapaExistente.has(key)) mapaExistente.set(key, row.id);
  }

  const paraAtualizar: Array<{ id: number; item: PresencaBimestralSyncItem }> = [];
  const paraInserir: any[] = [];
  const agora = new Date();

  for (const item of uniqueItems) {
    const key = `${item.alunoId}:${item.bimestre}:${item.disciplina}`;
    const existingId = mapaExistente.get(key);
    if (existingId) {
      paraAtualizar.push({ id: existingId, item });
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

  for (let k = 0; k < paraAtualizar.length; k += 200) {
    const chunk = paraAtualizar.slice(k, k + 200);
    const params: any[] = [];
    const valuesSql = chunk
      .map(({ id, item }, idx) => {
        const base = idx * 5;
        params.push(id, item.totalAulas, item.faltas, item.percentualFrequencia, agora);
        return `($${base + 1}::int, $${base + 2}::int, $${base + 3}::int, $${base + 4}::numeric, $${base + 5}::timestamp)`;
      })
      .join(", ");

    await withDbRetry(
      () =>
        pool.query(
          `UPDATE "presencas" AS p
           SET "total_aulas" = v.total_aulas,
               "faltas" = v.faltas,
               "percentual_frequencia" = v.percentual_frequencia::numeric(5,2),
               "data_atualizacao" = v.data_atualizacao
           FROM (VALUES ${valuesSql}) AS v(id, total_aulas, faltas, percentual_frequencia, data_atualizacao)
           WHERE p."id" = v.id`,
          params
        ),
      "upsertPresencasBimestraisLote:update"
    );
  }

  for (let k = 0; k < paraInserir.length; k += 300) {
    const chunk = paraInserir.slice(k, k + 300);
    await withDbRetry(
      () => db.insert(presencasTable).values(chunk),
      "upsertPresencasBimestraisLote:insert"
    );
  }

  return uniqueItems.length;
}

/**
 * Remove linhas fantasma antigas (sem nota_1, nota_2 e nota_final) geradas para bimestres futuros.
 */
export async function limparNotasFantasmasDisciplina(alunoIds: number[], disciplina: string): Promise<void> {
  if (alunoIds.length === 0) return;
  await withDbRetry(
    () =>
      db
        .delete(notasTable)
        .where(
          and(
            inArray(notasTable.alunoId, alunoIds),
            eq(notasTable.disciplina, disciplina),
            isNull(notasTable.nota1),
            isNull(notasTable.nota2),
            isNull(notasTable.notaFinal)
          )
        ),
    "limparNotasFantasmasDisciplina"
  );
}


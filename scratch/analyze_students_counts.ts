import { db } from "../lib/db/src/index.js";
import { alunosTable } from "../lib/db/src/schema/index.js";
import { sql } from "drizzle-orm";

async function run() {
  console.log("=== ANÁLISE DE ALUNOS NO BANCO DE DADOS ===");

  // 1. Total Geral
  const [totalGeral] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable);
  console.log(`\n1. Total Geral de Registros na tabela 'alunos': ${totalGeral.count}`);

  // 2. Por arquivo_morto
  const porArquivoMorto = await db.select({
    arquivoMorto: alunosTable.arquivoMorto,
    count: sql<number>`count(*)`
  }).from(alunosTable).groupBy(alunosTable.arquivoMorto);
  console.log("\n2. Contagem por 'arquivo_morto':", porArquivoMorto);

  // 3. Por situacao
  const porSituacao = await db.select({
    situacao: alunosTable.situacao,
    count: sql<number>`count(*)`
  }).from(alunosTable).groupBy(alunosTable.situacao);
  console.log("\n3. Contagem por 'situacao':", porSituacao);

  // 4. Por situacao e arquivo_morto
  const porSitEArq = await db.select({
    arquivoMorto: alunosTable.arquivoMorto,
    situacao: alunosTable.situacao,
    count: sql<number>`count(*)`
  }).from(alunosTable).groupBy(alunosTable.arquivoMorto, alunosTable.situacao);
  console.log("\n4. Cruzamento arquivo_morto x situacao:", porSitEArq);

  // 5. Total Ativos (arquivoMorto = 0 AND situacao = 'Matriculado') - O que a Dashboard usa
  const [dashboardAtivos] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    sql`arquivo_morto = 0 AND situacao = 'Matriculado'`
  );
  console.log(`\n5. Total retornado no Dashboard (arquivo_morto=0 E situacao='Matriculado'): ${dashboardAtivos.count}`);

  // 6. Total na Lista de Alunos GET /api/alunos (onde arquivoMorto = 0)
  const [listaAlunosTotal] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    sql`arquivo_morto = 0`
  );
  console.log(`\n6. Total retornado em GET /api/alunos (sem filtros, apenas arquivo_morto=0): ${listaAlunosTotal.count}`);

  // 7. Agrupamento por Turma (arquivoMorto = 0)
  const porTurma = await db.select({
    turmaAtual: alunosTable.turmaAtual,
    situacao: alunosTable.situacao,
    count: sql<number>`count(*)`
  }).from(alunosTable).where(sql`arquivo_morto = 0`).groupBy(alunosTable.turmaAtual, alunosTable.situacao).orderBy(alunosTable.turmaAtual);
  console.log("\n7. Alunos por Turma (arquivo_morto = 0):", porTurma);

  // 8. Checar duplicatas de Matrícula ou Nome
  const dupesMatricula = await db.select({
    matricula: alunosTable.matricula,
    count: sql<number>`count(*)`
  }).from(alunosTable).where(sql`matricula IS NOT NULL AND matricula != ''`).groupBy(alunosTable.matricula).having(sql`count(*) > 1`);
  console.log("\n8. Matrículas Duplicadas:", dupesMatricula);

  const dupesNome = await db.select({
    nomeCompleto: alunosTable.nomeCompleto,
    count: sql<number>`count(*)`
  }).from(alunosTable).groupBy(alunosTable.nomeCompleto).having(sql`count(*) > 1`);
  console.log("\n9. Nomes Duplicados:", dupesNome);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

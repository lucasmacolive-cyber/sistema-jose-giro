// @ts-nocheck
import { db, alunos, turmasTable, notasTable, presencasTable, diarioPresencasTable, diarioAulasTable } from "../api/lib/db/index.ts";

async function run() {
  console.log("Iniciando limpeza de alunos, turmas e dependências...");
  try {
    console.log("Limpando notas...");
    await db.delete(notasTable);
    console.log("Limpando presenças...");
    await db.delete(presencasTable);
    console.log("Limpando presenças de diário...");
    await db.delete(diarioPresencasTable);
    console.log("Limpando aulas de diário...");
    await db.delete(diarioAulasTable);
    console.log("Limpando alunos...");
    await db.delete(alunos);
    console.log("Limpando turmas...");
    await db.delete(turmasTable);
    console.log("Limpeza concluída com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("Erro na limpeza:", err);
    process.exit(1);
  }
}

run();

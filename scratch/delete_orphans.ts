import { db } from "../lib/db/src/index.js";
import { alunosTable } from "../lib/db/src/schema/index.js";
import { isNull, or, eq } from "drizzle-orm";

async function run() {
  console.log("Procurando alunos sem turma...");

  const orfAos = await db.select().from(alunosTable).where(
    or(
      isNull(alunosTable.turmaAtual),
      eq(alunosTable.turmaAtual, "")
    )
  );

  console.log(`Encontrados ${orfAos.length} alunos sem turma.`);

  if (orfAos.length > 0) {
    console.log("Removendo alunos sem turma...");
    await db.delete(alunosTable).where(
      or(
        isNull(alunosTable.turmaAtual),
        eq(alunosTable.turmaAtual, "")
      )
    );
    console.log("Alunos removidos com sucesso.");
  } else {
    console.log("Nenhum aluno para remover.");
  }

  process.exit(0);
}

run().catch(console.error);

import { db } from "../api/lib/db/index.ts";
import { alunos } from "../api/lib/db/index.ts";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const counts = await db
      .select({ situacao: alunos.situacao, count: sql<number>`count(*)::int` })
      .from(alunos)
      .groupBy(alunos.situacao);
    console.log("Situações dos alunos e contagem:", counts);
  } catch (err) {
    console.error("Erro:", err);
  }
}
run();

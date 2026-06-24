import { db } from "../lib/db/src/index.js";
import { diarioAulasTable, diarioPresencasTable } from "../lib/db/src/schema/diario.js";
import { alunosTable } from "../lib/db/src/schema/alunos.js";
import { eq, sql } from "drizzle-orm";

async function main() {
  try {
    const res = await db.execute(sql`
      SELECT 
        dp.status,
        count(*) as count
      FROM diario_presencas dp
      JOIN diario_aulas da ON dp.aula_id = da.id
      WHERE da.turma_nome = '1AT02'
      GROUP BY dp.status
    `);
    console.log("Presence stats for 1AT02:", res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();

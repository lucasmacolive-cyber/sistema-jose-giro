import path from "path";
import { importarAlunosXLS } from "../api/services/importService.ts";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function testAyla() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const file = path.join(process.cwd(), "attached_assets", "Relatorio_(18)_1775062997555.xls");
  console.log("Importing file:", file);

  const result = await importarAlunosXLS(file);
  console.log("Import result:", result);

  const ayla = await pool.query("SELECT id, nome_completo, turma_atual, turno FROM alunos WHERE nome_completo ILIKE '%AYLA OHANNA%';");
  console.log("Ayla in DB after import:", ayla.rows);

  await pool.end();
  process.exit(0);
}

testAyla().catch(err => {
  console.error(err);
  process.exit(1);
});

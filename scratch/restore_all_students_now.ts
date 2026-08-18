import path from "path";
import { importarAlunosXLS } from "../api/services/importService.ts";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function restore() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const file = path.join(process.cwd(), "attached_assets", "Relatorio_(18)_1775062997555.xls");
  console.log("Restaurando alunos a partir de:", file);

  const result = await importarAlunosXLS(file);
  console.log("Resultado da restauração:", result);

  const totalVivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0;");
  console.log(`Total de alunos ATIVOS agora: ${totalVivos.rows[0].count}`);

  await pool.end();
  process.exit(0);
}

restore().catch(err => {
  console.error(err);
  process.exit(1);
});

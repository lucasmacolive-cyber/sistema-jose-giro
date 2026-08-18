import path from "path";
import { importarAlunosXLS } from "../api/services/importService.ts";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function restore() {
  console.log("=== RESTAURANDO ALUNOS A PARTIR DO RELATÓRIO SUAP ===");
  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  console.log("Arquivo de relatório:", xlsPath);

  const res = await importarAlunosXLS(xlsPath);
  console.log("Resultado da importação:", res);

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const total = await pool.query("SELECT COUNT(*) FROM alunos;");
  const vivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0 OR arquivo_morto IS NULL;");
  const mortos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 1;");

  console.log("\n=== STATUS APÓS RESTAURAÇÃO ===");
  console.log("Total Alunos na tabela:", total.rows[0].count);
  console.log("Alunos Ativos (arquivo_morto = 0):", vivos.rows[0].count);
  console.log("Alunos Arquivados (arquivo_morto = 1):", mortos.rows[0].count);

  await pool.end();
  process.exit(0);
}

restore().catch(err => {
  console.error("Erro ao restaurar alunos:", err);
  process.exit(1);
});

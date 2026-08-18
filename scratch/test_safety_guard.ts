import { processarImportacaoAlunos } from "../api/services/importService.ts";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

async function testGuard() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Simulando upload de arquivo parcial (com apenas 1 linha)...");

  // Passa apenas 1 linha fictícia para processarImportacaoAlunos com substituirTudo: true
  const mockRows = [
    { "Nome do Aluno": "Teste Ficticio Impossivel 999", "Turma": "1AM01" }
  ];

  const res = await processarImportacaoAlunos(mockRows, { substituirTudo: true });
  console.log("Resultado com trava de segurança:", res);

  const totalVivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0;");
  console.log(`Total de alunos ATIVOS no BD após o teste: ${totalVivos.rows[0].count}`);

  await pool.end();
  process.exit(0);
}

testGuard().catch(console.error);

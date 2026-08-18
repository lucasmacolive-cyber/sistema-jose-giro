import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto FROM alunos;");
  const alunos = dbAlunosRes.rows;

  console.log(`Total de alunos no banco: ${alunos.length}\n`);

  let mismatches: any[] = [];

  for (const a of alunos) {
    const turma = (a.turma_atual ?? "").toUpperCase().trim();
    const turno = (a.turno ?? "").toLowerCase().trim();

    let expectedTurno = "";
    if (turma.includes("M")) expectedTurno = "Manhã";
    else if (turma.includes("T")) expectedTurno = "Tarde";
    else if (turma.includes("N")) expectedTurno = "Noite";
    else if (turma.includes("I")) expectedTurno = "Integral";

    if (expectedTurno && turno && turno !== expectedTurno.toLowerCase()) {
      mismatches.push({
        id: a.id,
        nome: a.nome_completo,
        turmaAtual: a.turma_atual,
        turnoAtualNoBD: a.turno,
        turnoEsperadoPelaTurma: expectedTurno,
        arquivoMorto: a.arquivo_morto
      });
    }
  }

  console.log(`=== ALUNOS COM DESCOMPASSO ENTRE TURMA E TURNO NO BANCO: ${mismatches.length} ===`);
  console.table(mismatches);

  await pool.end();
}

main();

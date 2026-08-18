import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const getTurnoFromTurma = (turma: string): string | null => {
  if (!turma) return null;
  const t = turma.toUpperCase().trim();
  if (t.includes("M")) return "Manhã";
  if (t.includes("T")) return "Tarde";
  if (t.includes("N")) return "Noite";
  if (t.includes("I")) return "Integral";
  return null;
};

async function main() {
  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno FROM alunos;");
  const alunos = dbAlunosRes.rows;

  let fixedCount = 0;
  for (const a of alunos) {
    const turma = a.turma_atual ?? "";
    const expectedTurno = getTurnoFromTurma(turma);
    if (expectedTurno && a.turno !== expectedTurno) {
      await pool.query("UPDATE alunos SET turno = $1 WHERE id = $2;", [expectedTurno, a.id]);
      fixedCount++;
    }
  }

  console.log(`Fix completed: Updated shift (turno) for ${fixedCount} students in database.`);

  const remainingMismatches = await pool.query(`
    SELECT id, nome_completo, turma_atual, turno FROM alunos 
    WHERE (turma_atual LIKE '%M%' AND turno != 'Manhã') 
       OR (turma_atual LIKE '%T%' AND turno != 'Tarde');
  `);
  console.log(`Remaining shift mismatches: ${remainingMismatches.rows.length}`);

  await pool.end();
}

main();

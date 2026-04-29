// @ts-nocheck
import { db, alunos, turmasTable } from '../../lib/db/src/index.ts';
import { eq } from "drizzle-orm";

async function cleanup() {
  console.log('Iniciando limpeza de turmas...');

  try {
    const allAlunos = await db.select().from(alunos);
    console.log(`Processando ${allAlunos.length} alunos...`);

    const turmasSet = new Set<string>();

    for (const aluno of allAlunos) {
      const raw = aluno.turmaAtual || "";
      const match = raw.match(/\((.*?)\)/);
      const clean = match ? match[1].trim() : raw.trim();

      if (clean && clean !== raw) {
        await db.update(alunos)
          .set({ turmaAtual: clean })
          .where(eq(alunos.id, aluno.id));
        turmasSet.add(clean);
      } else if (clean) {
        turmasSet.add(clean);
      }
    }

    console.log('Alunos atualizados. Sincronizando tabela de turmas...');

    // Limpar e repopular
    await db.delete(turmasTable);
    
    for (const nome of turmasSet) {
      const turno = (nome.toUpperCase().includes(" M") || nome.toUpperCase().endsWith("M") || nome.toUpperCase().includes("AM")) ? "Manhã" : "Tarde";
      await db.insert(turmasTable).values({
        nomeTurma: nome,
        turno: turno
      });
    }

    console.log(`Concluído! ${turmasSet.size} turmas únicas criadas.`);
  } catch (err) {
    console.error('Erro no cleanup:', err);
  }
}

cleanup();

import { db, alunos as alunosTable, turmasTable, professoresTable, diarioPresencasTable } from "../api/lib/db/index.ts";
import { eq, inArray, sql } from "drizzle-orm";

const normalizarCPF = (raw: string | null | undefined): string => {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
};

async function run() {
  console.log("=== INICIANDO LIMPEZA DO BANCO DE DADOS ===");

  try {
    // 1. LIMPEZA DE ALUNOS DUPLICADOS
    const todosAlunos = await db.select().from(alunosTable);
    console.log(`Total de alunos carregados: ${todosAlunos.length}`);

    // Agrupar por CPF (se houver) ou por Nome
    const grupos = new Map<string, typeof todosAlunos>();

    for (const a of todosAlunos) {
      const cpfNorm = normalizarCPF(a.cpf);
      const chave = cpfNorm ? `cpf_${cpfNorm}` : `nome_${a.nomeCompleto.toLowerCase().trim()}`;
      
      if (!grupos.has(chave)) {
        grupos.set(chave, []);
      }
      grupos.get(chave)!.push(a);
    }

    let alunosDeletados = 0;
    let presencasRedirecionadas = 0;

    for (const [chave, lista] of grupos.entries()) {
      if (lista.length <= 1) continue;

      console.log(`Duplicidade encontrada para chave [${chave}]: ${lista.length} registros.`);

      // Escolher o master (prioridade para quem tem matricula, situacao Matriculado, e maior número de campos preenchidos)
      const classificar = (x: typeof lista[0]) => {
        let score = 0;
        if (x.matricula) score += 100;
        if (x.situacao === "Matriculado") score += 50;
        if (x.emailPessoal) score += 10;
        if (x.telefone) score += 10;
        if (x.cpf) score += 10;
        return score;
      };

      lista.sort((a, b) => classificar(b) - classificar(a));
      const master = lista[0];
      const duplicados = lista.slice(1);

      console.log(`Master mantido: ID ${master.id} - ${master.nomeCompleto} (${master.matricula})`);

      for (const dup of duplicados) {
        console.log(`- Mesclando ID ${dup.id} -> Master ${master.id}`);

        // Redirecionar presenças
        const presencasDup = await db.select().from(diarioPresencasTable).where(eq(diarioPresencasTable.alunoId, dup.id));
        for (const p of presencasDup) {
          // Verificar se o master já tem presença nessa mesma aula
          const [existeMaster] = await db
            .select()
            .from(diarioPresencasTable)
            .where(
              sql`${diarioPresencasTable.aulaId} = ${p.aulaId} AND ${diarioPresencasTable.alunoId} = ${master.id}`
            )
            .limit(1);

          if (existeMaster) {
            // Se o master já tem presença, deleta a presença duplicada
            await db.delete(diarioPresencasTable).where(eq(diarioPresencasTable.id, p.id));
          } else {
            // Se não tem, redireciona para o master
            await db.update(diarioPresencasTable).set({ alunoId: master.id }).where(eq(diarioPresencasTable.id, p.id));
          }
          presencasRedirecionadas++;
        }

        // Deletar aluno duplicado
        await db.delete(alunosTable).where(eq(alunosTable.id, dup.id));
        alunosDeletados++;
      }
    }

    console.log(`Fim da limpeza de alunos: ${alunosDeletados} alunos duplicados removidos. ${presencasRedirecionadas} presenças tratadas.`);

    // 2. LIMPEZA DE TURMAS EXTRAS (SEM ALUNOS)
    const turmas = await db.select().from(turmasTable);
    const alunos = await db.select().from(alunosTable);

    // Contar alunos ativos por turma
    const contagemTurmas = new Map<string, number>();
    for (const a of alunos) {
      if (a.turmaAtual && a.situacao === "Matriculado" && a.arquivoMorto === 0) {
        const tName = a.turmaAtual.toLowerCase().trim();
        contagemTurmas.set(tName, (contagemTurmas.get(tName) ?? 0) + 1);
      }
    }

    let turmasDeletadas = 0;
    for (const t of turmas) {
      const count = contagemTurmas.get(t.nomeTurma.toLowerCase().trim()) ?? 0;
      if (count === 0) {
        console.log(`Turma vazia detectada: ${t.nomeTurma} (0 alunos ativos). Deletando...`);

        // Remover referências de professores a essa turma
        await db
          .update(professoresTable)
          .set({ turmaManha: null })
          .where(eq(professoresTable.turmaManha, t.nomeTurma));

        await db
          .update(professoresTable)
          .set({ turmaTarde: null })
          .where(eq(professoresTable.turmaTarde, t.nomeTurma));

        // Deletar a turma
        await db.delete(turmasTable).where(eq(turmasTable.id, t.id));
        turmasDeletadas++;
      }
    }

    console.log(`Fim da limpeza de turmas: ${turmasDeletadas} turmas vazias/extras removidas.`);
    console.log("=== LIMPEZA CONCLUÍDA COM SUCESSO ===");
  } catch (err: any) {
    console.error("Erro fatal na limpeza:", err.message);
  }
}

run();

import { db } from "../lib/db/src/index.js";
import { alunosTable, turmasTable } from "../lib/db/src/schema/index.js";
import { eq, inArray } from "drizzle-orm";

async function run() {
  console.log("Iniciando limpeza do banco de dados...");

  // 1. Obter todas as turmas
  const allTurmas = await db.select().from(turmasTable);
  const outOfStandardNames = allTurmas
    .filter(t => t.nomeTurma.includes(".") || t.nomeTurma === "-")
    .map(t => t.nomeTurma);

  console.log(`Turmas fora do padrão a serem removidas (${outOfStandardNames.length}):`, outOfStandardNames.join(", "));

  // 2. Obter todos os alunos
  const allAlunos = await db.select().from(alunosTable);
  
  const groupedByName = new Map<string, typeof allAlunos>();
  
  for (const a of allAlunos) {
    const nomeNorm = a.nomeCompleto.trim().toUpperCase();
    if (!groupedByName.has(nomeNorm)) {
      groupedByName.set(nomeNorm, []);
    }
    groupedByName.get(nomeNorm)!.push(a);
  }

  const idsToDelete: number[] = [];

  for (const [name, records] of groupedByName.entries()) {
    if (records.length > 1) {
      // Find the best record to keep
      // Sort by ID descending (most recent first)
      records.sort((a, b) => b.id - a.id);
      
      let bestRecord = records.find(a => 
        a.turmaAtual && 
        a.turmaAtual.trim() !== "" && 
        !outOfStandardNames.includes(a.turmaAtual)
      );

      // se nenhum tiver turma boa, pega o mais recente (primeiro da lista ordenada)
      if (!bestRecord) {
        bestRecord = records[0];
      }

      // Todos os outros vão para a lista de exclusão
      for (const r of records) {
        if (r.id !== bestRecord.id) {
          idsToDelete.push(r.id);
        }
      }
    }
  }

  console.log(`Encontrados ${idsToDelete.length} registros de alunos duplicados para exclusão.`);

  // 3. Executar as exclusões e atualizações
  if (idsToDelete.length > 0) {
    console.log("Limpando alunos duplicados...");
    // Split into chunks of 100 to avoid parameter limit issues
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const chunk = idsToDelete.slice(i, i + 100);
      await db.delete(alunosTable).where(inArray(alunosTable.id, chunk));
    }
    console.log("Alunos duplicados removidos.");
  }

  if (outOfStandardNames.length > 0) {
    console.log("Atualizando turmaAtual para null nos alunos órfãos...");
    await db.update(alunosTable)
      .set({ turmaAtual: null })
      .where(inArray(alunosTable.turmaAtual, outOfStandardNames));
    
    console.log("Removendo turmas fora do padrão...");
    await db.delete(turmasTable)
      .where(inArray(turmasTable.nomeTurma, outOfStandardNames));
    console.log("Turmas fora do padrão removidas.");
  }

  console.log("Limpeza concluída com sucesso!");
  process.exit(0);
}

run().catch((error) => {
  console.error("Erro durante a limpeza:", error);
  process.exit(1);
});

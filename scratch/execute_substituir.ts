import { importarAlunosXLS, processarImportacaoAlunos } from "../api/services/importService.ts";
import { db, alunos, turmasTable } from "../api/lib/db/index.ts";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "Relatorio (1).xls");
  console.log(`Lendo arquivo: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Linhas no Excel: ${data.length}`);
  console.log("Iniciando importação com SUBSTITUIR TUDO (substituirTudo = true)...");
  
  const res = await processarImportacaoAlunos(data, { substituirTudo: true });
  console.log("Resultado da importação:", res);
  
  console.log("Iniciando cleanup de turmas...");
  
  const allAlunos = await db.select().from(alunos);
  const turmasSet = new Set<string>();

  for (const aluno of allAlunos) {
    // Apenas considerar alunos ativos (arquivoMorto === 0)
    if (aluno.arquivoMorto === 1) continue;
    
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

  console.log(`Sincronizando tabela de turmas com as ${turmasSet.size} turmas ativas...`);
  await db.delete(turmasTable);
  
  for (const nome of turmasSet) {
    const upper = nome.toUpperCase();
    const turno = (upper.includes(" M") || upper.endsWith("M") || upper.includes("AM") || upper.includes("1M")) ? "Manhã" : "Tarde";
    await db.insert(turmasTable).values({
      nomeTurma: nome,
      turno: turno
    });
  }

  console.log("=== LIMPEZA E SUBSTITUIÇÃO CONCLUÍDAS COM SUCESSO! ===");
  
  // Contar turmas cadastradas agora
  const finalTurmas = await db.select().from(turmasTable);
  console.log(`Total de turmas restantes no banco: ${finalTurmas.length}`);
  for (const t of finalTurmas) {
    console.log(`- ${t.nomeTurma} (${t.turno})`);
  }
}

main().catch(console.error);

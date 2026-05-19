import { importarAlunosXLS } from "../artifacts/api-server/src/services/importService.js";
import path from "path";

async function run() {
  const filePath = path.resolve("Relatorio (1).xls");
  console.log(`Iniciando importação manual do arquivo: ${filePath}`);
  
  try {
    const result = await importarAlunosXLS(filePath);
    console.log("\n✅ Importação concluída com sucesso!");
    console.log(`- Alunos adicionados novos: ${result.adicionados}`);
    console.log(`- Alunos atualizados (já existiam): ${result.atualizados}`);
    console.log(`- Alunos transferidos/arquivados: ${result.transferidos || 0}`);
    console.log(`- Erros durante o processo: ${result.erros}`);
    
  } catch (error) {
    console.error("Erro fatal na importação:", error);
  }
  
  process.exit(0);
}

run();

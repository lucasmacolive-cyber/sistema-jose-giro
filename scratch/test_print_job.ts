import { db } from "../lib/db/src/index.js";
import { impressoesTable } from "../lib/db/src/schema/impressoes.js";

async function main() {
  console.log("Inserindo job de teste na tabela impressoes...");
  try {
    const [inserted] = await db.insert(impressoesTable).values({
      professorSolicitante: "Teste Antigravity",
      linkArquivo: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      nomeArquivo: "teste_antigravity.pdf",
      tipoArquivo: "pdf",
      status: "Pendente",
      quantidadeCopias: 1,
      colorida: false,
      impressoraNome: "RICOH SP 3710SF PCL 6"
    }).returning();
    
    console.log("Job inserido com sucesso!", inserted);
  } catch (err) {
    console.error("Erro ao inserir job de teste:", err);
  }
  process.exit(0);
}

main();

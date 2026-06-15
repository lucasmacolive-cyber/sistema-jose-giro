// @ts-nocheck
import { db } from "../lib/db/src";
import { configuracoesTable } from "../lib/db/src/schema/configuracoes";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Preenchendo e-mail da escola na tabela configuracoes...");
  try {
    await db.insert(configuracoesTable)
      .values({ 
        chave: "escola_email", 
        valor: "em.josegirofaisca@edu.campos.rj.gov.br", 
        atualizadoEm: new Date() 
      })
      .onConflictDoUpdate({
        target: configuracoesTable.chave,
        set: { valor: "em.josegirofaisca@edu.campos.rj.gov.br", atualizadoEm: new Date() }
      });
    console.log("E-mail da escola (em.josegirofaisca@edu.campos.rj.gov.br) salvo com sucesso!");

    // Verificar
    const rows = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "escola_email"));
    console.log("Resultado no DB:", rows);
  } catch (err) {
    console.error("Erro ao salvar e-mail:", err);
  }
  process.exit(0);
}

main();

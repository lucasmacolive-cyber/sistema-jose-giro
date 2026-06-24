// @ts-nocheck
import { db } from "../lib/db/src";
import { configuracoesTable } from "../lib/db/src/schema/configuracoes";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Preenchendo IPs das impressoras na tabela configuracoes...");
  try {
    // RICOH IP
    await db.insert(configuracoesTable)
      .values({ chave: "impressora_ricoh_ip", valor: "192.168.2.7", atualizadoEm: new Date() })
      .onConflictDoUpdate({
        target: configuracoesTable.chave,
        set: { valor: "192.168.2.7", atualizadoEm: new Date() }
      });
    console.log("IP RICOH (192.168.2.7) salvo!");

    // EPSON IP
    await db.insert(configuracoesTable)
      .values({ chave: "impressora_epson_ip", valor: "192.168.18.75", atualizadoEm: new Date() })
      .onConflictDoUpdate({
        target: configuracoesTable.chave,
        set: { valor: "192.168.18.75", atualizadoEm: new Date() }
      });
    console.log("IP EPSON (192.168.18.75) salvo!");

    // Consultar para verificar
    const rows = await db.select().from(configuracoesTable);
    console.log("Configurações atuais na tabela:");
    for (const r of rows) {
      if (r.chave.includes("impressora")) {
        console.log(`- ${r.chave}: ${r.valor}`);
      }
    }
  } catch (err) {
    console.error("Erro ao configurar IPs:", err);
  }
  process.exit(0);
}

main();

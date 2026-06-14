// @ts-nocheck
import { db, configuracoesTable } from "./db/index.js";
import { eq } from "drizzle-orm";
import { filaWhatsappTable } from "./db/schema/fila-whatsapp.js";

export async function getWhatsAppStatus() {
  const codeRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  const readyRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  const numberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
  
  const code = codeRow[0]?.valor || null;
  const ready = readyRow[0]?.valor === "true";
  const number = numberRow[0]?.valor || null;

  return { ready, code, number };
}

export async function generateWhatsAppPairing(number: string) {
  const cleanNumber = number.replace(/\D/g, "");
  await db.insert(configuracoesTable).values({ chave: "whatsapp_target_number", valor: cleanNumber, atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: cleanNumber, atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_command", valor: "generate", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "generate", atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "false", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "false", atualizadoEm: new Date() } });
}

export async function sendWhatsAppMessage(to: string, message: string) {
  const cleanTo = to.replace(/\D/g, "");
  await db.insert(filaWhatsappTable).values({
    numero: cleanTo,
    mensagem: message,
    tipo: "texto",
    status: "Pendente"
  });
}

export async function disconnectWhatsApp() {
  await db.insert(configuracoesTable).values({ chave: "whatsapp_command", valor: "logout", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "logout", atualizadoEm: new Date() } });
}

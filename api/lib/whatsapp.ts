import { db, configuracoesTable } from "./db/index.js";
import { eq, like } from "drizzle-orm";
import { filaWhatsappTable } from "./db/schema/fila-whatsapp.js";

export function initWhatsApp() {
  // A inicialização agora é feita pelo robô local (robo_whatsapp.js).
  // A Vercel não roda o Puppeteer mais.
  console.log("[WhatsApp] Vercel configurada em modo fila para o robô local.");
}

export async function getWhatsAppStatus() {
  const readyRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  const numberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
  const codeRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  
  const ready = readyRow[0]?.valor === "true";
  const number = numberRow[0]?.valor || null;
  const code = codeRow[0]?.valor || null;

  return {
    ready: ready,
    code: code,
    number: number,
  };
}

export async function disconnectWhatsApp() {
  // Envia comando sob novo protocolo
  await db.insert(configuracoesTable).values({
    chave: "whatsapp_command_disconnect",
    valor: "true",
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: "true", atualizadoEm: new Date() },
  });

  // Envia comando sob antigo protocolo (compatibilidade)
  await db.insert(configuracoesTable).values({
    chave: "whatsapp_command",
    valor: "logout",
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: "logout", atualizadoEm: new Date() },
  });

  // Limpa estado local do painel e credenciais do Baileys
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
  await db.delete(configuracoesTable).where(like(configuracoesTable.chave, "baileys_%"));
}

export async function generateWhatsApp(number: string) {
  let cleanNumber = number.replace(/\D/g, "");
  if (cleanNumber.length === 10 || cleanNumber.length === 11) {
    cleanNumber = "55" + cleanNumber;
  }

  // Limpa estado de pareamento anterior para o novo começar limpo
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));

  // Salva o número alvo formatado nas configurações (ambos protocolos)
  await db.insert(configuracoesTable).values({
    chave: "whatsapp_target_number",
    valor: cleanNumber,
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: cleanNumber, atualizadoEm: new Date() },
  });

  await db.insert(configuracoesTable).values({
    chave: "whatsapp_number",
    valor: cleanNumber,
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: cleanNumber, atualizadoEm: new Date() },
  });

  // Envia o comando de geração (ambos protocolos)
  await db.insert(configuracoesTable).values({
    chave: "whatsapp_command_generate",
    valor: cleanNumber,
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: cleanNumber, atualizadoEm: new Date() },
  });

  await db.insert(configuracoesTable).values({
    chave: "whatsapp_command",
    valor: "generate",
    atualizadoEm: new Date(),
  }).onConflictDoUpdate({
    target: configuracoesTable.chave,
    set: { valor: "generate", atualizadoEm: new Date() },
  });
}

export async function sendWhatsAppMessage(to: string, message: string) {
  // Apenas salva na fila
  await db.insert(filaWhatsappTable).values({
    numero: to,
    mensagem: message,
    status: "Pendente",
  });
}

export async function sendWhatsAppDocument(to: string, fileBuffer: Buffer, fileName: string, mimetype: string, caption?: string) {
  // Salva o buffer como base64 na fila
  const base64 = fileBuffer.toString("base64");
  await db.insert(filaWhatsappTable).values({
    numero: to,
    mensagem: caption || null,
    arquivoBase64: base64,
    mimetype: mimetype,
    nomeArquivo: fileName,
    status: "Pendente",
  });
}

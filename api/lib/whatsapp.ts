import { db, configuracoesTable } from "./db/index.ts";
import { eq } from "drizzle-orm";
import { filaWhatsappTable } from "./db/schema/fila-whatsapp.ts";

export function initWhatsApp() {
  // A inicialização agora é feita pelo robô local (robo_whatsapp.js).
  // A Vercel não roda o Puppeteer mais.
  console.log("[WhatsApp] Vercel configurada em modo fila para o robô local.");
}

export async function getWhatsAppStatus() {
  const qrRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_qr"));
  const readyRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  
  const qr = qrRow[0]?.valor || null;
  const ready = readyRow[0]?.valor === "true";

  return {
    ready: ready,
    qr: qr,
  };
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

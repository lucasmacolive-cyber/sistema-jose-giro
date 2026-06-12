import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import { db, configuracoesTable } from "./db/index.ts";
import { eq } from "drizzle-orm";

let client: Client | null = null;
let qrCodeData: string | null = null;
let isReady = false;

export function initWhatsApp() {
  if (client) return;
  console.log("[WhatsApp] Inicializando cliente...");

  client = new Client({
    authStrategy: new LocalAuth({ clientId: "escola-bot" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    console.log("[WhatsApp] QR Code recebido, aguardando scan...");
    // Generate data URI
    qrCodeData = await qrcode.toDataURL(qr);
    isReady = false;
  });

  client.on("ready", () => {
    console.log("[WhatsApp] Cliente está pronto!");
    isReady = true;
    qrCodeData = null;
  });

  client.on("authenticated", () => {
    console.log("[WhatsApp] Autenticado com sucesso!");
  });

  client.on("auth_failure", msg => {
    console.error("[WhatsApp] Falha na autenticação:", msg);
    isReady = false;
    qrCodeData = null;
  });

  client.on("disconnected", (reason) => {
    console.log("[WhatsApp] Desconectado:", reason);
    isReady = false;
    qrCodeData = null;
    client?.initialize(); // Tenta reconectar
  });

  client.initialize().catch(err => {
    console.error("[WhatsApp] Erro ao inicializar:", err);
  });
}

export function getWhatsAppStatus() {
  return {
    ready: isReady,
    qr: qrCodeData,
  };
}

export async function sendWhatsAppMessage(to: string, message: string) {
  if (!client || !isReady) {
    throw new Error("WhatsApp não está conectado.");
  }
  // Formatar número para o padrão do whatsapp-web.js (ex: 5521999999999@c.us)
  let formattedNumber = to.replace(/\D/g, "");
  if (!formattedNumber.startsWith("55")) {
    formattedNumber = "55" + formattedNumber;
  }
  if (!formattedNumber.endsWith("@c.us") && !formattedNumber.endsWith("@g.us")) {
    formattedNumber += "@c.us";
  }

  await client.sendMessage(formattedNumber, message);
}

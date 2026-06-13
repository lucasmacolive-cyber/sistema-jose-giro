// @ts-nocheck
import makeWASocket, { DisconnectReason, useMultiFileAuthState, Browsers, isJidGroup } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db, configuracoesTable } from "./db/index.js";
import { eq } from "drizzle-orm";
import { filaWhatsappTable } from "./db/schema/fila-whatsapp.js";

// Custom Auth State to store Baileys keys in PostgreSQL
const usePostgresAuthState = async () => {
  const writeData = async (data: any, id: string) => {
    const key = `baileys_${id}`;
    const value = JSON.stringify(data, (k, v) => (typeof v === "bigint" ? v.toString() : v));
    await db.insert(configuracoesTable)
      .values({ chave: key, valor: value, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: value, atualizadoEm: new Date() } });
  };

  const readData = async (id: string) => {
    const key = `baileys_${id}`;
    const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, key));
    if (row.length === 0 || !row[0].valor) return null;
    return JSON.parse(row[0].valor, (k, v) => {
      // Restore Buffer and BigInt if necessary
      if (v !== null && typeof v === 'object' && 'type' in v && v.type === 'Buffer' && 'data' in v) {
        return Buffer.from(v.data);
      }
      return v;
    });
  };

  const removeData = async (id: string) => {
    const key = `baileys_${id}`;
    await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, key));
  };

  const creds = await readData("creds") || (makeWASocket as any).initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          for (const id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) {
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                await writeData(value, key);
              } else {
                await removeData(key);
              }
            }
          }
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
};

let sock: any = null;

export async function connectToWhatsApp(pairingNumber?: string): Promise<any> {
  if (sock) return sock;

  const { state, saveCreds } = await usePostgresAuthState();
  const logger = pino({ level: "silent" });

  sock = makeWASocket.default({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  return new Promise((resolve, reject) => {
    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === "close") {
        sock = null;
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          // Em Vercel não queremos ficar num loop infinito. Em requests Serverless é melhor retornar erro.
          reject(new Error("Conexão com WhatsApp fechada. Tente novamente."));
        } else {
          // Limpa credenciais se deslogou
          await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
          reject(new Error("WhatsApp Desconectado pelo usuário."));
        }
      } else if (connection === "open") {
        await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "true" })
          .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "true" } });
        resolve(sock);
      }
    });

    if (pairingNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(pairingNumber);
          // Salva o código no banco para a API ler
          await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: code, atualizadoEm: new Date() })
            .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: code, atualizadoEm: new Date() } });
          resolve(sock); // Retorna a socket mesmo antes de conectar (open) para o frontend ler o code
        } catch (err) {
          reject(err);
        }
      }, 3000);
    } else if (sock.authState.creds.registered) {
      // Se já estiver registrado, o evento "open" será disparado logo em seguida, aguardando no listener acima
    }
  });
}

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
  // Limpa o estado anterior caso exista
  await db.insert(configuracoesTable).values({ chave: "whatsapp_number", valor: number })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: number } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "false" })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "false" } });
  
  const cleanNumber = number.replace(/\D/g, "");
  sock = null; // forca nova conexao
  await connectToWhatsApp(cleanNumber);
}

export async function sendWhatsAppMessage(to: string, message: string) {
  const socket = await connectToWhatsApp();
  const cleanTo = to.replace(/\D/g, "") + "@s.whatsapp.net";
  await socket.sendMessage(cleanTo, { text: message });
  // Opcional: Se for Vercel, fechar a conexão graciosamente? 
  // Em serverless, podemos fechar a socket após 2 segundos se precisar economizar recursos
}

export async function disconnectWhatsApp() {
  if (sock) {
    sock.logout();
    sock = null;
  }
  // Limpa o banco de dados
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
}

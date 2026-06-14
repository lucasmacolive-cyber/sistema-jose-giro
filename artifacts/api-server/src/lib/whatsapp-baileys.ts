// @ts-nocheck
import makeWASocket, { DisconnectReason, initAuthCreds, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db, configuracoesTable } from "./db/index.js";
import { eq } from "drizzle-orm";

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

  const creds = await readData("creds") || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          for (const id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) data[id] = value;
          }
          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) await writeData(value, key);
              else await removeData(key);
            }
          }
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
};

let sock: any = null;

export async function connectToWhatsApp(pairingNumber?: string, waitForOpen: boolean = false): Promise<any> {
  if (sock) return sock;

  const { state, saveCreds } = await usePostgresAuthState();
  const logger = pino({ level: "silent" });

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  return new Promise((resolve, reject) => {
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        resolve(sock); 
      }
    }, 50000);

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (!shouldReconnect) {
          await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
          sock = null;
        }
        if (!isResolved && !waitForOpen) {
          clearTimeout(timeout);
          isResolved = true;
          reject(new Error("Conexão fechada."));
        }
      } else if (connection === "open") {
        await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "true", atualizadoEm: new Date() })
          .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "true", atualizadoEm: new Date() } });
        
        if (!isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          resolve(sock);
        }
      }
    });

    if (pairingNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(pairingNumber);
          await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: code, atualizadoEm: new Date() })
            .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: code, atualizadoEm: new Date() } });
          
          if (!waitForOpen && !isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            resolve(sock);
          }
        } catch (err) {
          if (!isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            reject(err);
          }
        }
      }, 2500);
    } else if (sock.authState.creds.registered && !waitForOpen) {
      if (!isResolved) {
        clearTimeout(timeout);
        isResolved = true;
        resolve(sock);
      }
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
  const cleanNumber = number.replace(/\D/g, "");
  
  await db.insert(configuracoesTable).values({ chave: "whatsapp_number", valor: cleanNumber, atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: cleanNumber, atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "false", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "false", atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: "", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "", atualizadoEm: new Date() } });

  if (sock) {
    try { sock.logout(); } catch(e){}
  }
  sock = null; 
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
  
  await connectToWhatsApp(cleanNumber, true);
}

export async function sendWhatsAppMessage(to: string, message: string) {
  const socket = await connectToWhatsApp();
  const cleanTo = to.replace(/\D/g, "") + "@s.whatsapp.net";
  await socket.sendMessage(cleanTo, { text: message });
  
  try { socket.end(undefined); } catch(e){}
  sock = null;
}

export async function disconnectWhatsApp() {
  if (sock) {
    try { sock.logout(); } catch(e){}
    sock = null;
  }
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
}

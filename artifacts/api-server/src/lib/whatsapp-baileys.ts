// @ts-nocheck
import makeWASocket, { DisconnectReason, initAuthCreds, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { db, configuracoesTable } from "./db/index.js";
import { eq, like } from "drizzle-orm";

const usePostgresAuthState = async () => {
  const writeData = async (data: any, id: string) => {
    const key = `baileys_${id}`;
    const value = JSON.stringify(data, (k, v) => (typeof v === "bigint" ? v.toString() : v));
    console.log(`[usePostgresAuthState] GRAVANDO chave: ${key}, tamanho: ${value.length}`);
    try {
      await db.insert(configuracoesTable)
        .values({ chave: key, valor: value, atualizadoEm: new Date() })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: value, atualizadoEm: new Date() } });
      console.log(`[usePostgresAuthState] GRAVADO com sucesso: ${key}`);
    } catch(err) {
      console.error(`[usePostgresAuthState] ERRO gravando ${key}:`, err);
    }
  };

  const readData = async (id: string) => {
    const key = `baileys_${id}`;
    try {
      const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, key));
      if (row.length === 0 || !row[0].valor) {
        console.log(`[usePostgresAuthState] LIDO chave: ${key} (vazia/não encontrada)`);
        return null;
      }
      console.log(`[usePostgresAuthState] LIDO chave: ${key} (sucesso)`);
      return JSON.parse(row[0].valor, (k, v) => {
        if (v !== null && typeof v === 'object' && 'type' in v && v.type === 'Buffer' && 'data' in v) {
          return Buffer.from(v.data);
        }
        return v;
      });
    } catch(err) {
      console.error(`[usePostgresAuthState] ERRO lendo ${key}:`, err);
      return null;
    }
  };

  const removeData = async (id: string) => {
    const key = `baileys_${id}`;
    console.log(`[usePostgresAuthState] REMOVENDO chave: ${key}`);
    try {
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, key));
      console.log(`[usePostgresAuthState] REMOVIDO com sucesso: ${key}`);
    } catch(err) {
      console.error(`[usePostgresAuthState] ERRO removendo ${key}:`, err);
    }
  };

  let creds = await readData("creds");
  if (!creds) {
    creds = initAuthCreds();
    console.log("[usePostgresAuthState] Inicializando creds novas e gravando no banco...");
    await writeData(creds, "creds");
  }

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
    saveCreds: () => {
      console.log("[usePostgresAuthState] saveCreds acionado");
      return writeData(creds, "creds");
    }
  };
};

let sock: any = null;
let hasRequestedPairingCode = false;

async function appendWhatsAppLog(msg: string) {
  const time = new Date().toLocaleTimeString("pt-BR");
  const line = `[${time}] ${msg}`;
  console.log(line);
  try {
    const res = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_logs")).limit(1);
    let logs = [];
    if (res.length > 0) {
      try { logs = JSON.parse(res[0].valor); } catch(e){}
    }
    logs.push(line);
    if (logs.length > 100) logs.shift();
    await db.insert(configuracoesTable).values({ chave: "whatsapp_logs", valor: JSON.stringify(logs), atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: JSON.stringify(logs), atualizadoEm: new Date() } });
  } catch(e) {
    console.error("Erro gravando log do bot no banco:", e);
  }
}

function formatToWhatsAppJidNumber(num: string): string {
  let clean = num.replace(/\D/g, "");
  if (clean.length === 10 || clean.length === 11) {
    clean = "55" + clean;
  }
  // Removido o drop automático do dígito 9 para evitar erros de autenticação (401)
  // ao parear contas que utilizam o nono dígito no WhatsApp.
  return clean;
}

export async function connectToWhatsApp(pairingNumber?: string, waitForOpen: boolean = false): Promise<any> {
  if (sock) return sock;

  const { state, saveCreds } = await usePostgresAuthState();
  const logger = pino({ level: "trace" });

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  const formattedPairingNumber = pairingNumber ? formatToWhatsAppJidNumber(pairingNumber) : undefined;

  return new Promise((resolve, reject) => {
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        resolve(sock); 
      }
    }, 50000);

    // Fallback: solicita o código de pareamento por delay se não receber evento QR imediatamente
    if (formattedPairingNumber && !sock.authState.creds.registered) {
      setTimeout(async () => {
        if (!hasRequestedPairingCode && sock && !sock.authState.creds.registered) {
          hasRequestedPairingCode = true;
          try {
            await appendWhatsAppLog(`[Conexão] Solicitando Código de Pareamento para ${formattedPairingNumber}...`);
            let code = await sock.requestPairingCode(formattedPairingNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: code, atualizadoEm: new Date() })
              .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: code, atualizadoEm: new Date() } });
            await appendWhatsAppLog(`[Conexão] Código de Pareamento gerado: ${code}`);
            
            if (!waitForOpen && !isResolved) {
              clearTimeout(timeout);
              isResolved = true;
              resolve(sock);
            }
          } catch (err: any) {
            await appendWhatsAppLog(`[Erro] Falha ao solicitar pairing code: ${err.message}`);
            hasRequestedPairingCode = false; // permite tentar via QR se falhou
          }
        }
      }, 3000);
    }

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && formattedPairingNumber && sock && !sock.authState.creds.registered && !hasRequestedPairingCode) {
        hasRequestedPairingCode = true;
        try {
          let code = await sock.requestPairingCode(formattedPairingNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: code, atualizadoEm: new Date() })
            .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: code, atualizadoEm: new Date() } });
          
          if (!waitForOpen && !isResolved) {
            clearTimeout(timeout);
            isResolved = true;
            resolve(sock);
          }
        } catch (err) {
          console.error("Error requesting pairing code:", err);
        }
      }

      if (connection === "close") {
        hasRequestedPairingCode = false;
        const isRegistered = !!(sock?.authState?.creds?.me?.id || sock?.authState?.creds?.registered);
        sock = null; // Sempre define sock para null no fechamento para forçar a recriação na próxima tentativa
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        
        await appendWhatsAppLog(`[Conexão] Conexão fechada. Código de status: ${statusCode || "desconhecido"}. Reconectando...`);

        if (isLoggedOut && isRegistered) {
          await appendWhatsAppLog("[Conexão] Deslogado pelo usuário. Removendo credenciais...");
          await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
          await db.delete(configuracoesTable).where(like(configuracoesTable.chave, "baileys_%"));
        }
        
        if (!isResolved && !waitForOpen) {
          clearTimeout(timeout);
          isResolved = true;
          reject(new Error("Conexão fechada."));
        }
      } else if (connection === "open") {
        await appendWhatsAppLog(`[Conexão] Bot pronto e conectado com sucesso! Número: ${sock?.user?.id || ""}`);
        await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "true", atualizadoEm: new Date() })
          .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "true", atualizadoEm: new Date() } });
        
        try {
          const groups = await sock.groupFetchAllParticipating();
          for (const jid in groups) {
            const name = groups[jid].subject;
            const key = `wa_group_${jid}`;
            await db.insert(configuracoesTable).values({ chave: key, valor: name, atualizadoEm: new Date() })
              .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: name, atualizadoEm: new Date() } });
          }
        } catch (err) {
          console.error("Error fetching groups:", err);
        }

        if (!isResolved) {
          clearTimeout(timeout);
          isResolved = true;
          resolve(sock);
        }
      }
    });

    if (sock.authState.creds.registered && !waitForOpen) {
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
  const cleanNumber = formatToWhatsAppJidNumber(number);
  
  await db.insert(configuracoesTable).values({ chave: "whatsapp_number", valor: cleanNumber, atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: cleanNumber, atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_ready", valor: "false", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: cleanNumber, atualizadoEm: new Date() } });
  await db.insert(configuracoesTable).values({ chave: "whatsapp_pairing_code", valor: "", atualizadoEm: new Date() })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "", atualizadoEm: new Date() } });

  if (sock) {
    try { sock.logout(); } catch(e){}
  }
  sock = null; 
  hasRequestedPairingCode = false;
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "baileys_creds"));
  
  await connectToWhatsApp(cleanNumber, true);
}

export async function sendWhatsAppMessage(to: string, message: string, fileBase64?: string | null, mimetype?: string | null, filename?: string | null) {
  const socket = await connectToWhatsApp();
  let cleanTo = to;
  if (!cleanTo.includes("@g.us")) {
    cleanTo = formatToWhatsAppJidNumber(cleanTo) + "@s.whatsapp.net";
  }
  if (fileBase64) {
    const buffer = Buffer.from(fileBase64, "base64");
    await socket.sendMessage(cleanTo, {
      document: buffer,
      mimetype: mimetype || "application/pdf",
      fileName: filename || "documento.pdf",
      caption: message || ""
    });
  } else {
    await socket.sendMessage(cleanTo, { text: message });
  }
}

export async function disconnectWhatsApp() {
  if (sock) {
    try { sock.logout(); } catch(e){}
    sock = null;
  }
  hasRequestedPairingCode = false;
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
  await db.delete(configuracoesTable).where(like(configuracoesTable.chave, "baileys_%"));
}



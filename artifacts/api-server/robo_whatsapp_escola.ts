// @ts-nocheck
import { connectToWhatsApp, disconnectWhatsApp, getWhatsAppStatus } from './src/lib/whatsapp-baileys.js';
import { db, configuracoesTable, filaWhatsappTable } from './src/lib/db/index.js';
import { eq, isNull, and } from 'drizzle-orm';
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

dotenv.config();

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

// Override console logging to write directly to the log file
const logFile = path.join(process.cwd(), 'robo_whatsapp_log.txt');
function log(msg: any, ...args: any[]) {
  const time = new Date().toLocaleTimeString('pt-BR');
  const line = `[${time}] ${msg} ${args.join(' ')}\n`;
  try {
    fs.appendFileSync(logFile, line);
  } catch(e){}
  process.stdout.write(line);
}
console.log = log;
console.error = log;

let currentStatus = null;

async function hasValidSession() {
  const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'baileys_creds'));
  if (row.length === 0 || !row[0].valor) return false;
  try {
    const creds = JSON.parse(row[0].valor);
    return creds && creds.registered === true;
  } catch(e) {
    return false;
  }
}

async function loop() {
  try {
    const guiModeRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_gui_mode'));
    const guiMode = guiModeRow.length > 0 && guiModeRow[0].valor === 'true';

    if (guiMode) {
      const status = await getWhatsAppStatus();
      if (status.ready) {
        await appendWhatsAppLog("[Bot] Modo GUI ativado. Desconectando Baileys...");
        await disconnectWhatsApp();
      }
      setTimeout(loop, 10000);
      return;
    }

    // 1. Conecta apenas se houver sessão registrada ou um número alvo para parear
    const isRegistered = await hasValidSession();
    const targetNumberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_number'));
    const targetNumber = targetNumberRow.length > 0 ? targetNumberRow[0].valor : null;

    if (isRegistered || targetNumber) {
      try {
        await connectToWhatsApp(targetNumber || undefined, false);
      } catch(err) {
        // Ignora, não está registrado
      }
    }

    // 2. Lê comandos
    let numberToGenerate = null;
    let shouldGenerate = false;
    let shouldDisconnect = false;

    // Check new protocol generate command
    const cmdGenerate = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_generate'));
    if (cmdGenerate.length > 0) {
      numberToGenerate = cmdGenerate[0].valor;
      shouldGenerate = true;
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_generate'));
    }

    // Check old protocol command (from Vercel)
    const cmdOld = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command'));
    if (cmdOld.length > 0) {
      const cmdVal = cmdOld[0].valor;
      if (cmdVal === 'generate') {
        const targetNumberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_target_number'));
        numberToGenerate = targetNumberRow.length > 0 ? targetNumberRow[0].valor : null;
        shouldGenerate = true;
      } else if (cmdVal === 'logout') {
        shouldDisconnect = true;
      }
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command'));
    }

    // Check new protocol disconnect command
    const cmdDisconnect = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_disconnect'));
    if (cmdDisconnect.length > 0) {
      shouldDisconnect = true;
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_disconnect'));
    }

    if (shouldDisconnect) {
      await appendWhatsAppLog("[Bot] Comando recebido: Desconectar dispositivo.");
      await disconnectWhatsApp();
    }

    if (shouldGenerate && numberToGenerate) {
      await appendWhatsAppLog(`[Bot] Comando recebido: Gerar código para ${numberToGenerate}`);
      await disconnectWhatsApp();
      
      // Salva o whatsapp_number nas configurações (para que o loop de conexão automática saiba qual número usar)
      await db.insert(configuracoesTable).values({ chave: "whatsapp_number", valor: numberToGenerate, atualizadoEm: new Date() })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: numberToGenerate, atualizadoEm: new Date() } });
      
      await connectToWhatsApp(numberToGenerate, false);
    }

    try {
      const status = await getWhatsAppStatus();
      if (status.ready) {
        const fila = await db.select().from(filaWhatsappTable).where(eq(filaWhatsappTable.status, 'Pendente')).limit(5);
        for (const msg of fila) {
          await appendWhatsAppLog(`[Bot] Despachando mensagem da fila (ID: ${msg.id}) para ${msg.numero}...`);
          try {
            const { sendWhatsAppMessage } = await import('./src/lib/whatsapp-baileys.js');
            await sendWhatsAppMessage(msg.numero, msg.mensagem, msg.arquivoBase64, msg.mimetype, msg.nomeArquivo);
            await db.update(filaWhatsappTable).set({ status: 'Enviado', atualizadoEm: new Date() }).where(eq(filaWhatsappTable.id, msg.id));
            await appendWhatsAppLog(`[Bot] Mensagem (ID: ${msg.id}) enviada com sucesso para ${msg.numero}`);
          } catch(err: any) {
            await appendWhatsAppLog(`[Erro] Falha ao enviar mensagem (ID: ${msg.id}): ${err.message || String(err)}`);
            await db.update(filaWhatsappTable).set({ status: 'Erro', erro: String(err), atualizadoEm: new Date() }).where(eq(filaWhatsappTable.id, msg.id));
          }
        }
      }
    } catch(err) {
      console.error("Erro ao processar fila:", err);
    }

  } catch(err) {
    console.error("Erro no loop principal:", err);
  }

  setTimeout(loop, 5000);
}

console.log("=========================================");
console.log("ROBÔ DE WHATSAPP INICIADO");
console.log("=========================================");
loop();


// @ts-nocheck
import { connectToWhatsApp, disconnectWhatsApp, getWhatsAppStatus } from './src/lib/whatsapp-baileys.js';
import { db, configuracoesTable, filaWhatsappTable } from './src/lib/db/index.js';
import { eq, isNull, and } from 'drizzle-orm';
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

dotenv.config();

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
    // 1. Conecta apenas se houver sessão registrada ou um número alvo para parear
    const isRegistered = await hasValidSession();
    const targetNumberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_number'));
    const targetNumber = targetNumberRow.length > 0 ? targetNumberRow[0].valor : null;

    if (isRegistered || targetNumber) {
      try {
        await connectToWhatsApp(targetNumber || undefined, true);
      } catch(err) {
        // Ignora, não está registrado
      }
    }

    // 2. Lê comandos
    const cmdGenerate = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_generate'));
    if (cmdGenerate.length > 0) {
      const number = cmdGenerate[0].valor;
      console.log("Comando recebido: Gerar para", number);
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_generate'));
      
      // Limpa socket atual
      await disconnectWhatsApp();
      // Inicializa novo socket com pareamento (vai esperar 2.5s e chamar requestPairingCode e salvar no banco)
      await connectToWhatsApp(number, false);
    }

    const cmdDisconnect = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_disconnect'));
    if (cmdDisconnect.length > 0) {
      console.log("Comando recebido: Desconectar");
      await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_command_disconnect'));
      await disconnectWhatsApp();
    }

    // 3. Processa fila de mensagens (isso só funciona se estiver conectado, então ignoramos se der erro dentro do Baileys)
    try {
      const fila = await db.select().from(filaWhatsappTable).where(eq(filaWhatsappTable.status, 'Pendente')).limit(5);
      for (const msg of fila) {
        console.log("Enviando mensagem para", msg.numero);
        try {
          const { sendWhatsAppMessage } = await import('./src/lib/whatsapp-baileys.js');
          await sendWhatsAppMessage(msg.numero, msg.mensagem, msg.arquivoBase64, msg.mimetype, msg.nomeArquivo);
          await db.update(filaWhatsappTable).set({ status: 'Enviado', atualizadoEm: new Date() }).where(eq(filaWhatsappTable.id, msg.id));
        } catch(err) {
          console.error("Erro ao enviar msg:", err);
          await db.update(filaWhatsappTable).set({ status: 'Erro', erro: String(err), atualizadoEm: new Date() }).where(eq(filaWhatsappTable.id, msg.id));
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


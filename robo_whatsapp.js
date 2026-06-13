require("dotenv").config();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const qrcodeDataUrl = require("qrcode");
const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let isReady = false;

// Função auxiliar para atualizar configurações no banco de dados
async function updateConfig(chave, valor) {
  const query = `
    INSERT INTO configuracoes (chave, valor, atualizado_em)
    VALUES ($1, $2, NOW())
    ON CONFLICT (chave) 
    DO UPDATE SET valor = $2, atualizado_em = NOW();
  `;
  await pool.query(query, [chave, valor]);
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: "escola-bot" }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html"
  }
});

client.on("qr", async (qr) => {
  console.log("-----------------------------------------");
  console.log("[WhatsApp] QR Code recebido!");
  console.log("Acesse o painel do site (Ajustes -> Sincronização) para escanear o QR Code lá!");
  
  // Salvar no BD para exibir no site
  try {
    const dataUrl = await qrcodeDataUrl.toDataURL(qr);
    await updateConfig("whatsapp_qr", dataUrl);
    await updateConfig("whatsapp_ready", "false");
    isReady = false;
  } catch (err) {
    console.error("Erro ao salvar QR Code no BD:", err);
  }
});

client.on("ready", async () => {
  console.log("-----------------------------------------");
  console.log("[WhatsApp] Cliente pronto e conectado!");
  isReady = true;
  await updateConfig("whatsapp_qr", "");
  await updateConfig("whatsapp_ready", "true");
  if (client.info && client.info.wid) {
    await updateConfig("whatsapp_number", client.info.wid.user);
  }
});

client.on("authenticated", () => {
  console.log("[WhatsApp] Autenticado com sucesso!");
});

client.on("auth_failure", async (msg) => {
  console.error("[WhatsApp] Falha na autenticação:", msg);
  isReady = false;
  await updateConfig("whatsapp_ready", "false");
});

client.on("disconnected", async (reason) => {
  console.log("[WhatsApp] Desconectado:", reason);
  isReady = false;
  await updateConfig("whatsapp_ready", "false");
  client.initialize();
});

client.initialize();

// Loop de processamento da Fila e Comandos
setInterval(async () => {
  // 1. Verificar comandos pendentes
  try {
    const cmdRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_command'");
    if (cmdRes.rows.length > 0) {
      const cmd = cmdRes.rows[0].valor;
      if (cmd === "logout" || cmd === "generate") {
        console.log(`[WhatsApp] Comando recebido da nuvem: ${cmd}`);
        await updateConfig("whatsapp_command", ""); // limpa o comando
        
        // Sempre destrói o cliente para liberar a pasta
        try { await client.destroy(); } catch(err){}
        
        // Força a remoção da pasta de sessão para garantir que um novo QR Code seja gerado
        try { fs.rmSync(".wwebjs_auth", { recursive: true, force: true }); } catch(err){}
        
        isReady = false;
        await updateConfig("whatsapp_ready", "false");
        await updateConfig("whatsapp_number", "");
        await updateConfig("whatsapp_qr", ""); // limpa qr antigo
        
        // Inicializa do zero, o que forçará a emissão do evento 'qr'
        client.initialize();
      }
    }
  } catch (e) {
    console.error("Erro ao ler comando:", e);
  }

  if (!isReady) return;

  try {
    // Busca 1 mensagem pendente na fila
    const res = await pool.query(
      "SELECT * FROM fila_whatsapp WHERE status = 'Pendente' ORDER BY criado_em ASC LIMIT 1"
    );

    if (res.rows.length === 0) return; // Fila vazia

    const job = res.rows[0];
    console.log(`[Fila] Processando envio para ${job.numero}...`);

    let formattedNumber = job.numero.replace(/\D/g, "");
    if (!formattedNumber.startsWith("55")) formattedNumber = "55" + formattedNumber;
    if (!formattedNumber.endsWith("@c.us") && !formattedNumber.endsWith("@g.us")) {
      formattedNumber += "@c.us";
    }

    if (job.arquivo_base64 && job.mimetype && job.nome_arquivo) {
      const media = new MessageMedia(job.mimetype, job.arquivo_base64, job.nome_arquivo);
      await client.sendMessage(formattedNumber, media, { caption: job.mensagem || "" });
    } else if (job.mensagem) {
      await client.sendMessage(formattedNumber, job.mensagem);
    }

    // Marca como enviado
    await pool.query(
      "UPDATE fila_whatsapp SET status = 'Enviado', atualizado_em = NOW() WHERE id = $1",
      [job.id]
    );
    console.log(`[Fila] Enviado com sucesso para ${job.numero}!`);

  } catch (err) {
    console.error("[Fila] Erro ao processar mensagem:", err);
  }
}, 5000); // Verifica a fila a cada 5 segundos

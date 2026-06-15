require("dotenv").config();
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const pino = require("pino");
const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let isReady = false;
let sock = null;

async function updateConfig(chave, valor) {
  const query = `
    INSERT INTO configuracoes (chave, valor, atualizado_em)
    VALUES ($1, $2, NOW())
    ON CONFLICT (chave) 
    DO UPDATE SET valor = $2, atualizado_em = NOW();
  `;
  await pool.query(query, [chave, valor]);
}

async function startWhatsApp(pairingNumber = null) {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("[WhatsApp] Conexão fechada. Reconectando:", shouldReconnect);
      isReady = false;
      await updateConfig("whatsapp_ready", "false");
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      } else {
        // Logged out
        console.log("[WhatsApp] Deslogado. Removendo pasta auth e aguardando comandos...");
        fs.rmSync("baileys_auth", { recursive: true, force: true });
        sock = null;
      }
    } else if (connection === "open") {
      console.log("-----------------------------------------");
      console.log("[WhatsApp] Cliente pronto e conectado com sucesso!");
      isReady = true;
      await updateConfig("whatsapp_ready", "true");
      await updateConfig("whatsapp_pairing_code", ""); // clear code
      
      if (sock.user && sock.user.id) {
        const number = sock.user.id.split(":")[0];
        await updateConfig("whatsapp_number", number);
      }

      // Sincronizar grupos participando no banco de dados
      try {
        console.log("[WhatsApp] Buscando grupos participando...");
        const groups = await sock.groupFetchAllParticipating();
        for (const jid in groups) {
          const name = groups[jid].subject;
          const key = `wa_group_${jid}`;
          await updateConfig(key, name);
        }
        console.log(`[WhatsApp] ${Object.keys(groups).length} grupos sincronizados!`);
      } catch (err) {
        console.error("[WhatsApp] Erro ao sincronizar grupos:", err.message);
      }
    }
  });

  // Pairing code request (apenas se for nova conexão e numero fornecido)
  if (pairingNumber && !sock.authState.creds.me) {
    // Wait until socket is ready to request code
    setTimeout(async () => {
      try {
        console.log(`[WhatsApp] Solicitando Pairing Code para ${pairingNumber}...`);
        let code = await sock.requestPairingCode(pairingNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`[WhatsApp] Código de Pareamento: ${code}`);
        await updateConfig("whatsapp_pairing_code", code);
      } catch (err) {
        console.error("[WhatsApp] Erro ao gerar pairing code:", err);
      }
    }, 2500);
  }
}

// Inicia com sessão local se existir
if (fs.existsSync("baileys_auth")) {
  startWhatsApp();
}

// Loop de Fila e Comandos
setInterval(async () => {
  try {
    const cmdRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_command'");
    if (cmdRes.rows.length > 0) {
      const cmd = cmdRes.rows[0].valor;
      
      if (cmd === "logout") {
        console.log(`[WhatsApp] Comando recebido: logout`);
        await updateConfig("whatsapp_command", "");
        if (sock) {
          try { await sock.logout(); } catch(err){}
        } else {
          fs.rmSync("baileys_auth", { recursive: true, force: true });
        }
        await updateConfig("whatsapp_ready", "false");
      } 
      else if (cmd === "generate") {
        console.log(`[WhatsApp] Comando recebido: generate`);
        await updateConfig("whatsapp_command", "");
        
        // Remove sessão antiga
        if (sock) {
          try { await sock.logout(); } catch(err){}
        }
        fs.rmSync("baileys_auth", { recursive: true, force: true });
        sock = null;
        isReady = false;
        
        // Obter número alvo
        const numRes = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_target_number'");
        const targetNum = numRes.rows[0]?.valor || "";
        
        if (targetNum) {
          await startWhatsApp(targetNum);
        } else {
          console.error("[WhatsApp] Nenhum numero fornecido para gerar código!");
        }
      }
    }
  } catch (err) {
    console.error("[Loop] Erro checando comandos:", err.message);
  }

  // Se estiver conectado, envia mensagens da fila
  if (isReady && sock) {
    try {
      const resFila = await pool.query(`
        SELECT id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo 
        FROM fila_whatsapp 
        WHERE status = 'Pendente' 
        ORDER BY criado_em ASC LIMIT 1
      `);
      
      if (resFila.rows.length > 0) {
        const msg = resFila.rows[0];
        console.log(`[WhatsApp] Enviando msg para ${msg.numero}...`);
        
        // Formatar numero (adicionar 55 se nao tiver) e @s.whatsapp.net
        let jid = msg.numero;
        if (!jid.includes("@g.us")) {
          if (!jid.startsWith("55")) jid = "55" + jid;
          if (!jid.includes("@s.whatsapp.net")) jid = jid + "@s.whatsapp.net";
        }

        if (msg.arquivo_base64) {
          const buffer = Buffer.from(msg.arquivo_base64, "base64");
          await sock.sendMessage(jid, { 
            document: buffer, 
            mimetype: msg.mimetype || "application/pdf", 
            fileName: msg.nome_arquivo || "Documento.pdf",
            caption: msg.mensagem || undefined
          });
        } else {
          await sock.sendMessage(jid, { text: msg.mensagem });
        }

        await pool.query("UPDATE fila_whatsapp SET status = 'Enviado', atualizado_em = NOW() WHERE id = $1", [msg.id]);
        console.log(`[WhatsApp] Msg ${msg.id} enviada com sucesso!`);
      }
    } catch (err) {
      console.error("[WhatsApp] Erro ao enviar da fila:", err.message);
    }
  }

  // Processa automações agendadas a cada 30 segundos
  const nowMs = Date.now();
  if (nowMs - lastAutomationCheck >= 30000) {
    lastAutomationCheck = nowMs;
    await processarAutomatizacoes();
  }
}, 3000);

let lastAutomationCheck = 0;

function limparNumero(tel) {
  if (!tel) return "";
  return tel.replace(/\D/g, "");
}

function formatarMensagem(auto, nomeDestinatario) {
  const base = auto.mensagem || "";
  const tipo = auto.tipo_documento;
  const agora = new Date().toLocaleDateString("pt-BR");

  if (tipo === "mensagem") return base.replace(/{nome}/g, nomeDestinatario);

  const prefixos = {
    ficai:       `📋 *FICAI - ${agora}*\n`,
    freq_mensal: `📊 *Frequência Mensal - ${agora}*\n`,
    resumo_turma:`📝 *Resumo de Turma - ${agora}*\n`,
    pre_diario:  `📆 *Pré-diário - ${agora}*\n`,
  };
  const prefixo = prefixos[tipo] || "";
  const body = base ? base.replace(/{nome}/g, nomeDestinatario) : `Olá ${nomeDestinatario}, segue o documento solicitado.`;
  return `${prefixo}${body}`;
}

function calcularProxima(frequencia, diasSemana, diaMes, horario) {
  const agora = new Date();
  const [h, m] = (horario || "08:00").split(":").map(Number);

  if (frequencia === "unico") {
    const d = new Date(agora);
    d.setHours(h, m, 0, 0);
    if (d <= agora) d.setDate(d.getDate() + 1);
    return d;
  }

  if (frequencia === "diario") {
    const d = new Date(agora);
    d.setHours(h, m, 0, 0);
    if (d <= agora) d.setDate(d.getDate() + 1);
    return d;
  }

  if (frequencia === "semanal" && diasSemana) {
    const dias = diasSemana.split(",").map(Number); // 0=Dom, 1=Seg...
    for (let i = 1; i <= 7; i++) {
      const d = new Date(agora);
      d.setDate(d.getDate() + i);
      d.setHours(h, m, 0, 0);
      if (dias.includes(d.getDay())) return d;
    }
  }

  if (frequencia === "mensal" && diaMes) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), diaMes, h, m, 0, 0);
    if (d <= agora) {
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  return null;
}

async function processarAutomatizacoes() {
  try {
    const agora = new Date();
    const resAuto = await pool.query(
      `SELECT * FROM automatizacoes_whatsapp 
       WHERE ativa = true AND proxima_execucao <= $1`,
      [agora]
    );

    for (const auto of resAuto.rows) {
      console.log(`[WhatsApp] Processando automação: "${auto.nome}" (tipo: ${auto.tipo_documento})...`);
      
      let destinatarios = [];
      const tipo = auto.destinatario_tipo;
      const valor = auto.destinatario_valor;

      if (tipo === "numero") {
        if (valor) destinatarios.push({ numero: valor, nome: "destinatário" });
      } else if (tipo === "professor") {
        if (valor) {
          const res = await pool.query("SELECT nome, telefone FROM professores WHERE id = $1", [parseInt(valor)]);
          destinatarios = res.rows.filter(r => r.telefone).map(r => ({ numero: limparNumero(r.telefone), nome: r.nome }));
        }
      } else if (tipo === "todos_professores") {
        const res = await pool.query("SELECT nome, telefone FROM professores");
        destinatarios = res.rows.filter(r => r.telefone).map(r => ({ numero: limparNumero(r.telefone), nome: r.nome }));
      } else if (tipo === "grupo") {
        if (valor) destinatarios.push({ numero: valor, nome: "Grupo" });
      } else if (tipo === "turma_alunos") {
        if (valor) {
          const res = await pool.query("SELECT nome_completo as nome, telefone as tel FROM alunos WHERE turma_atual = $1", [valor]);
          destinatarios = res.rows.filter(r => r.tel).map(r => ({ numero: limparNumero(r.tel), nome: r.nome }));
        }
      } else if (tipo === "todos_alunos") {
        const res = await pool.query("SELECT nome_completo as nome, telefone as tel FROM alunos");
        destinatarios = res.rows.filter(r => r.tel).map(r => ({ numero: limparNumero(r.tel), nome: r.nome }));
      } else if (tipo === "funcionarios") {
        const res = await pool.query("SELECT nome_completo as nome, telefone_contato as tel FROM funcionarios");
        destinatarios = res.rows.filter(r => r.tel).map(r => ({ numero: limparNumero(r.tel), nome: r.nome }));
      }

      console.log(`[WhatsApp] Encontrados ${destinatarios.length} destinatários para "${auto.nome}"`);

      for (const dest of destinatarios) {
        const mensagem = formatarMensagem(auto, dest.nome);
        await pool.query(
          `INSERT INTO fila_whatsapp (numero, mensagem, arquivo_base64, mimetype, nome_arquivo, status, criado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, 'Pendente', NOW(), NOW())`,
          [
            dest.numero,
            mensagem,
            auto.arquivo_base64 || null,
            auto.mimetype || null,
            auto.nome_arquivo || null
          ]
        );
      }

      // Calcula próxima execução e desativa se for execução única
      const proxima = calcularProxima(auto.frequencia, auto.dias_semana, auto.dia_mes, auto.horario);
      const ativa = auto.frequencia === "unico" ? false : true;

      await pool.query(
        `UPDATE automatizacoes_whatsapp 
         SET ultima_execucao = $1, proxima_execucao = $2, ativa = $3, atualizado_em = NOW()
         WHERE id = $4`,
        [agora, proxima, ativa, auto.id]
      );

      console.log(`[WhatsApp] Automação "${auto.nome}" atualizada. Próxima: ${proxima ? proxima.toISOString() : "N/A"}. Ativa: ${ativa}`);
    }
  } catch (err) {
    console.error("[WhatsApp] Erro ao processar automações:", err.message);
  }
}

console.log("[WhatsApp Bot] Aguardando inicialização ou comandos da nuvem...");

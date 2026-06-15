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
  if (pairingNumber) {
    pairingNumber = pairingNumber.replace(/\D/g, "");
    if (pairingNumber.length === 10 || pairingNumber.length === 11) {
      pairingNumber = "55" + pairingNumber;
    }
  }
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

      // Auto-join no grupo da escola
      try {
        console.log("[WhatsApp] Obtendo info do grupo da escola pelo link...");
        const inviteCode = "KHNYnbYZonpHkiWACW5UHS";
        const info = await sock.groupGetInviteInfo(inviteCode);
        if (info && info.id) {
          console.log("[WhatsApp] JID do grupo obtido pelo link:", info.id);
          await updateConfig("escola_whatsapp_grupo", info.id);
        }
        console.log("[WhatsApp] Solicitando entrada no grupo da escola...");
        const groupJid = await sock.groupAcceptInvite(inviteCode);
        console.log("[WhatsApp] Entrada no grupo concluída:", groupJid);
      } catch (err) {
        console.log("[WhatsApp] Info de convite/entrada no grupo (pode já estar nele):", err.message);
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
        if (jid === "grupo_da_escola") {
          const res = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'escola_whatsapp_grupo'");
          const resolvedJid = res.rows[0]?.valor;
          if (resolvedJid) {
            jid = resolvedJid;
          } else {
            console.error("[WhatsApp] JID do grupo da escola não encontrado nas configurações!");
            throw new Error("Grupo da escola não está resolvido nas configurações.");
          }
        } else if (!jid.includes("@g.us")) {
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

function calcularProxima(frequencia, diasSemana, diaMes, horario, diasMesStr) {
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

  if (frequencia === "mensal") {
    let dias = [];
    if (diasMesStr) {
      dias = diasMesStr.split(",").map(Number).filter(d => d >= 1 && d <= 31);
    } else if (diaMes) {
      dias = [diaMes];
    }

    if (dias.length === 0) return null;

    let proximaData = null;
    for (let i = 0; i <= 40; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, h, m, 0, 0);
      if (d <= agora) continue;
      if (dias.includes(d.getDate())) {
        proximaData = d;
        break;
      }
    }
    return proximaData;
  }

  return null;
}

const DIAS_NAO_LETIVOS_2026 = new Set([
  // February
  "16/02/2026", "17/02/2026", "18/02/2026", "19/02/2026", "20/02/2026",
  // April
  "03/04/2026", "21/04/2026", "23/04/2026", "24/04/2026",
  // May
  "01/05/2026",
  // June
  "04/06/2026", "05/06/2026",
  // July
  "13/07/2026", "14/07/2026", "15/07/2026", "16/07/2026", "17/07/2026", "20/07/2026", "21/07/2026", "22/07/2026", "23/07/2026", "24/07/2026",
  // September
  "07/09/2026",
  // October
  "12/10/2026", "15/10/2026", "16/10/2026",
  // November
  "02/11/2026", "20/11/2026",
  // December
  "25/12/2026"
]);

function isDiaLetivo(dataStr) {
  if (dataStr.endsWith("/01/2026")) return false;
  const [d, m, y] = dataStr.split("/").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  if (DIAS_NAO_LETIVOS_2026.has(dataStr)) return false;
  return true;
}

async function gerarRelatorioFICAI(escopo, alvo, mes, ano) {
  const cfgRes = await pool.query("SELECT chave, valor FROM diario_configuracoes");
  const cfgMap = {};
  for (const r of cfgRes.rows) cfgMap[r.chave] = r.valor;
  const thresholdConsec = Number(cfgMap["ficai_faltas_consecutivas"] ?? 3);
  const thresholdMensais = Number(cfgMap["ficai_faltas_mensais"] ?? 5);

  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `%/${mesFormatado}/${ano}`;

  let aulasRes = await pool.query("SELECT id, data, turma_nome FROM diario_aulas WHERE data LIKE $1 ORDER BY data ASC", [pattern]);
  let aulas = aulasRes.rows;

  let alunosRes = await pool.query("SELECT id, nome_completo, turma_atual FROM alunos WHERE situacao = 'Matriculado'");
  let alunos = alunosRes.rows;

  if (escopo === "aluno" && alvo) {
    alunos = alunos.filter(a => String(a.id) === alvo);
  } else if (escopo === "turma" && alvo) {
    const turmasList = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turma_atual && turmasList.includes(a.turma_atual));
    aulas = aulas.filter(a => turmasList.includes(a.turma_nome));
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap = {};
  if (aulaIds.length > 0) {
    const presRes = await pool.query("SELECT aula_id, aluno_id, status FROM diario_presencas WHERE aula_id = ANY($1)", [aulaIds]);
    for (const p of presRes.rows) {
      if (!presMap[p.aula_id]) presMap[p.aula_id] = {};
      presMap[p.aula_id][p.aluno_id] = p.status;
    }
  }

  function parseDate(s) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  const alertas = [];
  for (const aluno of alunos) {
    if (!aluno.turma_atual) continue;
    const aulasAluno = aulas
      .filter(a => a.turma_nome === aluno.turma_atual)
      .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
    if (!aulasAluno.length) continue;

    let maxConsec = 0, currentConsec = 0;
    let faltasMensais = 0;
    const datasFaltas = [];

    for (const aula of aulasAluno) {
      const status = presMap[aula.id]?.[aluno.id] ?? "P";
      if (status === "F") {
        currentConsec++;
        faltasMensais++;
        datasFaltas.push(aula.data);
        if (currentConsec > maxConsec) {
          maxConsec = currentConsec;
        }
      } else {
        currentConsec = 0;
      }
    }

    const emAlerta = maxConsec >= thresholdConsec || faltasMensais >= thresholdMensais;
    if (emAlerta) {
      alertas.push({
        nome: aluno.nome_completo,
        turma: aluno.turma_atual,
        maxConsec,
        faltasMensais,
        datasFaltas
      });
    }
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RELATÓRIO ALERTA FICAI - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `Escopo: ${escopo === "aluno" ? "Aluno Específico" : escopo === "turma" ? `Turma(s) (${alvo})` : "Todas as Turmas"}\n`;
  text += `${"=".repeat(60)}\n\n`;
  text += `Critérios de Alerta:\n`;
  text += `- Faltas Consecutivas >= ${thresholdConsec}\n`;
  text += `- Faltas Mensais no Mês >= ${thresholdMensais}\n`;
  text += `${"=".repeat(60)}\n\n`;

  if (alertas.length === 0) {
    text += `Nenhum aluno em situação de alerta FICAI para os parâmetros selecionados.\n`;
  } else {
    alertas.forEach((a, idx) => {
      text += `${idx + 1}. NOME: ${a.nome}\n`;
      text += `   TURMA: ${a.turma}\n`;
      text += `   FALTAS CONSECUTIVAS MÁXIMAS: ${a.maxConsec}\n`;
      text += `   TOTAL DE FALTAS NO MÊS: ${a.faltasMensais}\n`;
      text += `   DATAS DAS FALTAS: ${a.datasFaltas.join(", ") || "Nenhuma"}\n`;
      text += `--------------------------------------------------\n`;
    });
    text += `\nTotal de alunos em alerta: ${alertas.length}\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Alerta_FICAI_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioFrequenciaMensal(escopo, alvo, mes, ano) {
  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `%/${mesFormatado}/${ano}`;

  let aulasRes = await pool.query("SELECT id, data, turma_nome FROM diario_aulas WHERE data LIKE $1 ORDER BY data ASC", [pattern]);
  let aulas = aulasRes.rows;

  let alunosRes = await pool.query("SELECT id, nome_completo, turma_atual FROM alunos WHERE situacao = 'Matriculado' ORDER BY nome_completo ASC");
  let alunos = alunosRes.rows;

  if (escopo === "aluno" && alvo) {
    alunos = alunos.filter(a => String(a.id) === alvo);
  } else if (escopo === "turma" && alvo) {
    const turmasList = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turma_atual && turmasList.includes(a.turma_atual));
    aulas = aulas.filter(a => turmasList.includes(a.turma_nome));
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap = {};
  if (aulaIds.length > 0) {
    const presRes = await pool.query("SELECT aula_id, aluno_id, status FROM diario_presencas WHERE aula_id = ANY($1)", [aulaIds]);
    for (const p of presRes.rows) {
      if (!presMap[p.aula_id]) presMap[p.aula_id] = {};
      presMap[p.aula_id][p.aluno_id] = p.status;
    }
  }

  const turmasComAulas = [...new Set(aulas.map(a => a.turma_nome))].sort();
  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RELATÓRIO DE FREQUÊNCIA MENSAL - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of turmasComAulas) {
    const aulasT = aulas.filter(a => a.turma_nome === tNome);
    const alunosT = alunos.filter(a => a.turma_atual === tNome);
    if (aulasT.length === 0 || alunosT.length === 0) continue;

    text += `TURMA: ${tNome} (${aulasT.length} aulas letivas registradas)\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `Nº | Nome do Aluno | Presenças | Faltas | % Freq\n`;
    text += `----------------------------------------------------------------------\n`;

    const risco = [];

    alunosT.forEach((al, idx) => {
      let faltas = 0;
      for (const au of aulasT) {
        if ((presMap[au.id]?.[al.id] ?? "P") === "F") {
          faltas++;
        }
      }
      const totalAulas = aulasT.length;
      const presencas = totalAulas - faltas;
      const pct = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 100;

      text += `${String(idx + 1).padStart(2, "0")} | ${al.nome_completo.padEnd(30)} | ${String(presencas).padStart(9)} | ${String(faltas).padStart(6)} | ${pct}%\n`;

      if (pct < 75) {
        risco.push({ nome: al.nome_completo, pct });
      }
    });

    if (risco.length > 0) {
      text += `\nAlunos com frequência crítica (abaixo de 75%):\n`;
      risco.forEach(r => {
        text += `- ${r.nome} (${r.pct}%)\n`;
      });
    }
    text += `\n${"=".repeat(70)}\n\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Frequencia_Mensal_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioResumoTurma(escopo, alvo, mes, ano) {
  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `%/${mesFormatado}/${ano}`;

  let aulasRes = await pool.query("SELECT id, data, turma_nome FROM diario_aulas WHERE data LIKE $1 ORDER BY data ASC", [pattern]);
  let aulas = aulasRes.rows;

  let alunosRes = await pool.query("SELECT id, nome_completo, turma_atual FROM alunos WHERE situacao = 'Matriculado' ORDER BY nome_completo ASC");
  let alunos = alunosRes.rows;

  let targetTurmas = [];
  if (escopo === "turma" && alvo) {
    targetTurmas = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turma_atual && targetTurmas.includes(a.turma_atual));
    aulas = aulas.filter(a => targetTurmas.includes(a.turma_nome));
  } else {
    targetTurmas = [...new Set(alunos.map(a => a.turma_atual).filter(Boolean))];
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap = {};
  if (aulaIds.length > 0) {
    const presRes = await pool.query("SELECT aula_id, aluno_id, status FROM diario_presencas WHERE aula_id = ANY($1)", [aulaIds]);
    for (const p of presRes.rows) {
      if (!presMap[p.aula_id]) presMap[p.aula_id] = {};
      presMap[p.aula_id][p.aluno_id] = p.status;
    }
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RESUMO DE TURMA - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of targetTurmas.sort()) {
    const aulasT = aulas.filter(a => a.turma_nome === tNome);
    const alunosT = alunos.filter(a => a.turma_atual === tNome);
    if (alunosT.length === 0) continue;

    const tInfoRes = await pool.query("SELECT turno, professor_responsavel FROM turmas WHERE nome_turma = $1", [tNome]);
    const tInfo = tInfoRes.rows[0] || {};

    let totalPresencas = 0;
    let totalFaltas = 0;
    let totalAulas = aulasT.length;

    alunosT.forEach(al => {
      for (const au of aulasT) {
        if ((presMap[au.id]?.[al.id] ?? "P") === "F") {
          totalFaltas++;
        } else {
          totalPresencas++;
        }
      }
    });

    const totalRegistros = totalPresencas + totalFaltas;
    const mediaFreq = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 100;

    text += `TURMA: ${tNome}\n`;
    text += `Turno: ${tInfo.turno || "Não especificado"}\n`;
    text += `Professor Responsável: ${tInfo.professor_responsavel || "Não especificado"}\n`;
    text += `Total de Alunos Matriculados: ${alunosT.length}\n`;
    text += `Aulas Registradas no Mês: ${totalAulas}\n`;
    text += `Frequência Média da Turma: ${mediaFreq}%\n`;
    text += `--------------------------------------------------\n\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Resumo_Turma_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioPreDiario(escopo, alvo, mes, ano) {
  const totalDias = new Date(ano, mes, 0).getDate();
  const diasLetivos = [];
  
  function getDiaSemana(dataStr) {
    const [d, m, y] = dataStr.split("/").map(Number);
    const date = new Date(y, m - 1, d);
    const nomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return nomes[date.getDay()];
  }

  for (let d = 1; d <= totalDias; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(mes).padStart(2, "0");
    const dataStr = `${dd}/${mm}/${ano}`;
    if (isDiaLetivo(dataStr)) {
      diasLetivos.push(`${dataStr} (${getDiaSemana(dataStr)})`);
    }
  }

  let targetTurmas = [];
  if (escopo === "turma" && alvo) {
    targetTurmas = alvo.split(",").map(t => t.trim()).filter(Boolean);
  } else {
    const allTRes = await pool.query("SELECT nome_turma FROM turmas ORDER BY nome_turma ASC");
    targetTurmas = allTRes.rows.map(t => t.nome_turma);
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `PRÉ-DIÁRIO - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of targetTurmas.sort()) {
    const tInfoRes = await pool.query("SELECT turno, professor_responsavel FROM turmas WHERE nome_turma = $1", [tNome]);
    const tInfo = tInfoRes.rows[0];
    if (!tInfo) continue;

    const alunosTRes = await pool.query(
      "SELECT nome_completo FROM alunos WHERE turma_atual = $1 AND arquivo_morto = 0 ORDER BY nome_completo ASC",
      [tNome]
    );
    const alunosT = alunosTRes.rows;

    text += `TURMA: ${tNome} (${tInfo.turno || "Não especificado"})\n`;
    text += `Professor Responsável: ${tInfo.professor_responsavel || "Não especificado"}\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `Nº | Nome do Aluno\n`;
    text += `----------------------------------------------------------------------\n`;
    alunosT.forEach((al, idx) => {
      text += `${String(idx + 1).padStart(2, "0")} | ${al.nome_completo}\n`;
    });
    text += `----------------------------------------------------------------------\n\n`;
  }

  text += `DIAS LETIVOS PREVISTOS:\n`;
  diasLetivos.forEach(d => {
    text += `- ${d}\n`;
  });

  return {
    conteudo: text,
    nomeArquivo: `Pre_Diario_${nomeMes}_${ano}.txt`
  };
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
        if (valor === "grupo_da_escola") {
          const res = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'escola_whatsapp_grupo'");
          const resolvedJid = res.rows[0]?.valor;
          if (resolvedJid) {
            destinatarios.push({ numero: resolvedJid, nome: "Grupo" });
          } else {
            destinatarios.push({ numero: "grupo_da_escola", nome: "Grupo" });
          }
        } else if (valor) {
          destinatarios.push({ numero: valor, nome: "Grupo" });
        }
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

      // Geração de documento dinâmico (se aplicável)
      let dynamicFile = {
        base64: auto.arquivo_base64 || null,
        mimetype: auto.mimetype || null,
        filename: auto.nome_arquivo || null
      };

      if (auto.tipo_documento && auto.tipo_documento !== "mensagem") {
        try {
          let mes = new Date().getMonth() + 1;
          let ano = new Date().getFullYear();
          if (auto.documento_mes && auto.documento_mes !== "atual") {
            const parsedMes = parseInt(auto.documento_mes);
            if (!isNaN(parsedMes)) mes = parsedMes;
          }

          let docResult = null;
          if (auto.tipo_documento === "ficai") {
            docResult = await gerarRelatorioFICAI(auto.documento_escopo || "todas", auto.documento_alvo, mes, ano);
          } else if (auto.tipo_documento === "freq_mensal") {
            docResult = await gerarRelatorioFrequenciaMensal(auto.documento_escopo || "todas", auto.documento_alvo, mes, ano);
          } else if (auto.tipo_documento === "resumo_turma") {
            docResult = await gerarRelatorioResumoTurma(auto.documento_escopo || "todas", auto.documento_alvo, mes, ano);
          } else if (auto.tipo_documento === "pre_diario") {
            docResult = await gerarRelatorioPreDiario(auto.documento_escopo || "todas", auto.documento_alvo, mes, ano);
          }

          if (docResult) {
            dynamicFile.base64 = Buffer.from(docResult.conteudo, "utf-8").toString("base64");
            dynamicFile.mimetype = "text/plain";
            dynamicFile.filename = docResult.nomeArquivo;
          }
        } catch (err) {
          console.error("[processarAutomatizacoes] Erro gerando relatório:", err.message);
        }
      }

      for (const dest of destinatarios) {
        const mensagem = formatarMensagem(auto, dest.nome);
        await pool.query(
          `INSERT INTO fila_whatsapp (numero, mensagem, arquivo_base64, mimetype, nome_arquivo, status, criado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, 'Pendente', NOW(), NOW())`,
          [
            dest.numero,
            mensagem,
            dynamicFile.base64,
            dynamicFile.mimetype,
            dynamicFile.filename
          ]
        );
      }

      // Calcula próxima execução e desativa se for execução única
      const proxima = calcularProxima(auto.frequencia, auto.dias_semana, auto.dia_mes, auto.horario, auto.dias_mes);
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

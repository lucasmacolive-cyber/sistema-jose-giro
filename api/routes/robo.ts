// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index.ts";
import { configuracoesTable } from "../lib/db/index.ts";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Helper to read setting
async function getChave(chave: string, defaultVal: string = ""): Promise<string> {
  const [row] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, chave)).limit(1);
  return row ? (row.valor || defaultVal) : defaultVal;
}

// Helper to write setting
async function setChave(chave: string, valor: string) {
  await db.insert(configuracoesTable)
    .values({ chave, valor, atualizadoEm: new Date() })
    .onConflictDoUpdate({
      target: configuracoesTable.chave,
      set: { valor, atualizadoEm: new Date() }
    });
}

// Helper to add log entry
async function addRoboLog(entry: {
  tipo?: string;
  evento: string;
  status: "sucesso" | "erro" | "em_andamento" | "info";
  detalhes?: string;
}) {
  try {
    const raw = await getChave("robo_historico_logs", "[]");
    let logs: any[] = [];
    try { logs = JSON.parse(raw); } catch { logs = []; }
    if (!Array.isArray(logs)) logs = [];

    const now = new Date();
    const dataHoraStr = now.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "America/Sao_Paulo"
    });

    const newLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      dataHora: dataHoraStr,
      timestamp: Date.now(),
      tipo: entry.tipo || "sistema",
      evento: entry.evento,
      status: entry.status || "info",
      detalhes: entry.detalhes || "",
    };

    logs.unshift(newLog);
    if (logs.length > 200) logs = logs.slice(0, 200);

    await setChave("robo_historico_logs", JSON.stringify(logs));
    return newLog;
  } catch (err) {
    console.error("Erro ao adicionar log no robô:", err);
    return null;
  }
}

async function getOrSeedRoboLogs() {
  const raw = await getChave("robo_historico_logs", "");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // Seed default logs if empty so UI displays meaningful content initially
  const statusRaw = await getChave("robo_status", "{}");
  let statusObj: any = {};
  try { statusObj = JSON.parse(statusRaw); } catch {}

  const initialLogs: any[] = [];
  const now = new Date();
  const dataHoraStr = (dt: Date) => dt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "America/Sao_Paulo"
  });

  if (statusObj?.ultimo_diarios) {
    initialLogs.push({
      id: "log_seed_1",
      dataHora: statusObj.ultimo_diarios.hora || dataHoraStr(now),
      timestamp: Date.now() - 3600000,
      tipo: "diarios",
      evento: "Última Sincronização de Diários",
      status: statusObj.ultimo_diarios.ok ? "sucesso" : "erro",
      detalhes: statusObj.ultimo_diarios.resultado || "Sincronização realizada pelo robô local."
    });
  }

  if (statusObj?.ultimo_alunos) {
    initialLogs.push({
      id: "log_seed_2",
      dataHora: statusObj.ultimo_alunos.hora || dataHoraStr(now),
      timestamp: Date.now() - 7200000,
      tipo: "alunos",
      evento: "Última Sincronização de Alunos",
      status: statusObj.ultimo_alunos.ok ? "sucesso" : "erro",
      detalhes: statusObj.ultimo_alunos.resultado || "Sincronização realizada pelo robô local."
    });
  }

  initialLogs.push({
    id: "log_seed_3",
    dataHora: dataHoraStr(now),
    timestamp: Date.now(),
    tipo: "sistema",
    evento: "Inicialização do Módulo de Histórico",
    status: "info",
    detalhes: "Histórico de atualizações do Robô Escolar ativado com sucesso."
  });

  await setChave("robo_historico_logs", JSON.stringify(initialLogs));
  return initialLogs;
}

/* ─── Endpoint para a Página Web ─── */

// GET /api/robo/status -> Retorna status, config e logs
router.get("/robo/status", async (_req, res) => {
  try {
    const lastHeartbeat = await getChave("last_heartbeat_robo");
    const statusRaw = await getChave("robo_status", "{}");
    const configRaw = await getChave("robo_config", '{"diarios":{"ativo":false,"horarios":[]},"alunos":{"ativo":false,"horarios":[]}}');
    const logs = await getOrSeedRoboLogs();

    const online = lastHeartbeat ? (Date.now() - new Date(lastHeartbeat).getTime() < 40000) : false;

    res.json({
      ok: true,
      online,
      status: JSON.parse(statusRaw),
      config: JSON.parse(configRaw),
      logs
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/robo/logs -> Retorna apenas o histórico de atualizações
router.get("/robo/logs", async (_req, res) => {
  try {
    const logs = await getOrSeedRoboLogs();
    res.json({ ok: true, logs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/robo/logs -> Registra novo evento de log manualmente
router.post("/robo/logs", async (req, res) => {
  try {
    const { tipo, evento, status, detalhes } = req.body;
    if (!evento) {
      return res.status(400).json({ ok: false, error: "O campo 'evento' é obrigatório." });
    }
    const newLog = await addRoboLog({ tipo, evento, status, detalhes });
    res.json({ ok: true, log: newLog, mensagem: "Log registrado com sucesso." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/robo/logs -> Limpa o histórico de logs
router.delete("/robo/logs", async (_req, res) => {
  try {
    await setChave("robo_historico_logs", JSON.stringify([]));
    res.json({ ok: true, mensagem: "Histórico de atualizações limpo com sucesso." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/robo/sync/diarios -> Dispara sync de diários
router.post("/robo/sync/diarios", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_diarios");
    await addRoboLog({
      tipo: "diarios",
      evento: "Sincronização de Diários Solicitada",
      status: "info",
      detalhes: "Comando enviado via painel web para a fila do robô da escola."
    });
    res.json({ ok: true, mensagem: "Comando de sincronização de diários agendado." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/robo/sync/alunos -> Dispara sync de alunos
router.post("/api/robo/sync/alunos", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_alunos");
    await addRoboLog({
      tipo: "alunos",
      evento: "Sincronização de Alunos Solicitada",
      status: "info",
      detalhes: "Comando enviado via painel web para a fila do robô da escola."
    });
    res.json({ ok: true, mensagem: "Comando de sincronização de alunos agendado." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Duplicando sem /api para bater com router.use
router.post("/robo/sync/alunos", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_alunos");
    await addRoboLog({
      tipo: "alunos",
      evento: "Sincronização de Alunos Solicitada",
      status: "info",
      detalhes: "Comando enviado via painel web para a fila do robô da escola."
    });
    res.json({ ok: true, mensagem: "Comando de sincronização de alunos agendado." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/robo/config -> Atualiza config de agenda
router.put("/robo/config", async (req, res) => {
  try {
    const newConfig = req.body;
    await setChave("robo_config", JSON.stringify(newConfig));
    await addRoboLog({
      tipo: "agenda",
      evento: "Agenda de Sincronização Atualizada",
      status: "sucesso",
      detalhes: "Novas configurações de horários e rotinas salvas no servidor."
    });
    res.json({ ok: true, mensagem: "Configuração de agenda salva no servidor." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


/* ─── Endpoint para o Robô Python / Node (Heartbeat) ─── */

// POST /api/robo/heartbeat -> Chamado pelo robô local na escola
router.post("/robo/heartbeat", async (req, res) => {
  try {
    const { status, log: customLog } = req.body; // status do robô em formato JSON object
    
    // Atualiza heartbeat e status no BD
    const agora = new Date().toISOString();
    await setChave("last_heartbeat_robo", agora);
    if (status) {
      await setChave("robo_status", JSON.stringify(status));
    }

    if (customLog && customLog.evento) {
      await addRoboLog(customLog);
    }

    // Busca comando pendente e config
    const comando = await getChave("robo_comando_pendente", "");
    const configRaw = await getChave("robo_config", '{"diarios":{"ativo":false,"horarios":[]},"alunos":{"ativo":false,"horarios":[]}}');

    // Se havia comando, limpa ele
    if (comando) {
      await setChave("robo_comando_pendente", "");
    }

    res.json({
      ok: true,
      comando: comando || null,
      config: JSON.parse(configRaw)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

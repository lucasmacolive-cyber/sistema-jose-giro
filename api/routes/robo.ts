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

/* ─── Endpoint para a Página Web ─── */

// GET /api/robo/status -> Retorna status e config
router.get("/robo/status", async (_req, res) => {
  try {
    const lastHeartbeat = await getChave("last_heartbeat_robo");
    const statusRaw = await getChave("robo_status", "{}");
    const configRaw = await getChave("robo_config", '{"diarios":{"ativo":false,"horarios":[]},"alunos":{"ativo":false,"horarios":[]}}');

    const online = lastHeartbeat ? (Date.now() - new Date(lastHeartbeat).getTime() < 40000) : false;

    res.json({
      ok: true,
      online,
      status: JSON.parse(statusRaw),
      config: JSON.parse(configRaw)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/robo/sync/diarios -> Dispara sync de diários
router.post("/robo/sync/diarios", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_diarios");
    res.json({ ok: true, mensagem: "Comando de sincronização de diários agendado." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/robo/sync/alunos -> Dispara sync de alunos
router.post("/api/robo/sync/alunos", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_alunos");
    res.json({ ok: true, mensagem: "Comando de sincronização de alunos agendado." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Duplicando sem /api para bater com router.use
router.post("/robo/sync/alunos", async (_req, res) => {
  try {
    await setChave("robo_comando_pendente", "sync_alunos");
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
    res.json({ ok: true, mensagem: "Configuração de agenda salva no servidor." });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


/* ─── Endpoint para o Robô Python (Heartbeat) ─── */

// POST /api/robo/heartbeat -> Chamado pelo robô local na escola
router.post("/robo/heartbeat", async (req, res) => {
  try {
    const { status } = req.body; // status do robô em formato JSON object
    
    // Atualiza heartbeat e status no BD
    const agora = new Date().toISOString();
    await setChave("last_heartbeat_robo", agora);
    if (status) {
      await setChave("robo_status", JSON.stringify(status));
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

import { Router, type IRouter } from "express";
import { getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppDocument, disconnectWhatsApp, generateWhatsApp } from "../lib/whatsapp.js";
import multer from "multer";
import { db, configuracoesTable, filaWhatsappTable } from "../lib/db/index.ts";
import { eq, ilike, desc } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/whatsapp/status", async (req, res) => {
  try {
    const status = await getWhatsAppStatus();
    res.json(status);
  } catch(err) {
    res.json({ ready: false, code: null, number: null, guiMode: false });
  }
});

router.post("/whatsapp/disconnect", async (req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/generate", async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) {
      return res.status(400).json({ error: "Número é obrigatório" });
    }
    await generateWhatsApp(number);
    res.json({ success: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/send", async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Número e mensagem são obrigatórios" });
  }

  try {
    await sendWhatsAppMessage(to, message);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/send-document", upload.single("arquivo"), async (req, res) => {
  const { numero, mensagem } = req.body;
  const arquivo = req.file;

  if (!numero || !arquivo) {
    return res.status(400).json({ error: "Número e arquivo são obrigatórios" });
  }

  try {
    await sendWhatsAppDocument(
      numero,
      arquivo.buffer,
      arquivo.originalname || "Documento.pdf",
      arquivo.mimetype || "application/pdf",
      mensagem
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("[WhatsApp Send Doc] Erro:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/gui-mode", async (req, res) => {
  const { enabled } = req.body;
  try {
    const value = enabled ? "true" : "false";
    await db.insert(configuracoesTable).values({ chave: "whatsapp_gui_mode", valor: value, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: value, atualizadoEm: new Date() } });
    res.json({ success: true, enabled: enabled });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/whatsapp/groups", async (req, res) => {
  try {
    const rows = await db.select().from(configuracoesTable).where(ilike(configuracoesTable.chave, "wa_group_%"));
    const groups = rows.map(r => ({
      jid: r.chave.replace("wa_group_", ""),
      nome: r.valor
    }));
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Listar fila de envio ───────────────────────────────────────────────────
router.get("/whatsapp/queue", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: filaWhatsappTable.id,
        numero: filaWhatsappTable.numero,
        mensagem: filaWhatsappTable.mensagem,
        nomeArquivo: filaWhatsappTable.nomeArquivo,
        mimetype: filaWhatsappTable.mimetype,
        status: filaWhatsappTable.status,
        erro: filaWhatsappTable.erro,
        criadoEm: filaWhatsappTable.criadoEm,
        atualizadoEm: filaWhatsappTable.atualizadoEm,
      })
      .from(filaWhatsappTable)
      .orderBy(desc(filaWhatsappTable.criadoEm))
      .limit(100);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reenviar mensagem ──────────────────────────────────────────────────────
router.post("/whatsapp/queue/:id/resend", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(filaWhatsappTable)
      .set({ status: "Pendente", erro: null, atualizadoEm: new Date() })
      .where(eq(filaWhatsappTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Deletar mensagem da fila ────────────────────────────────────────────────
router.delete("/whatsapp/queue/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(filaWhatsappTable).where(eq(filaWhatsappTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Obter logs do bot ───────────────────────────────────────────────────────
router.get("/whatsapp/logs", async (req, res) => {
  try {
    const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_logs"));
    if (row.length > 0 && row[0].valor) {
      const logs = JSON.parse(row[0].valor);
      res.json(logs);
    } else {
      res.json([]);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

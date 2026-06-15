import { Router, type IRouter } from "express";
import { getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppDocument, disconnectWhatsApp, generateWhatsApp } from "../lib/whatsapp.js";
import multer from "multer";
import { db, configuracoesTable } from "../lib/db/index.ts";
import { ilike } from "drizzle-orm";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/whatsapp/status", async (req, res) => {
  try {
    const status = await getWhatsAppStatus();
    res.json(status);
  } catch(err) {
    res.json({ ready: false, code: null, number: null });
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

export default router;

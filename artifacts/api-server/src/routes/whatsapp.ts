import { Router } from "express";
import { db, filaWhatsappTable, configuracoesTable } from "../lib/db/index.js";
import { eq, ilike } from "drizzle-orm";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/whatsapp/status", async (req, res) => {
  try {
    // O robô local atualiza as configurações
    const readyRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
    const ready = readyRow.length > 0 && readyRow[0].valor === "true";
    
    const codeRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
    const code = codeRow.length > 0 ? codeRow[0].valor : null;
    
    const numberRow = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
    const number = numberRow.length > 0 ? numberRow[0].valor : null;

    res.json({ ready, code, number });
  } catch(err) {
    res.json({ ready: false, code: null, number: null });
  }
});

router.post("/whatsapp/disconnect", async (req, res) => {
  try {
    await db.insert(configuracoesTable).values({ chave: "whatsapp_command_disconnect", valor: "true", atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: "true", atualizadoEm: new Date() } });
    // Remove local state on UI
    await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_ready"));
    await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_pairing_code"));
    await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, "whatsapp_number"));
    res.json({ success: true });
  } catch(err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/generate", async (req, res) => {
  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ error: "Número de telefone é obrigatório" });
  }
  try {
    await db.insert(configuracoesTable).values({ chave: "whatsapp_command_generate", valor: number, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: number, atualizadoEm: new Date() } });
    await db.insert(configuracoesTable).values({ chave: "whatsapp_number", valor: number, atualizadoEm: new Date() })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: number, atualizadoEm: new Date() } });
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
    await db.insert(filaWhatsappTable).values({ numero: to, mensagem: message, status: "Pendente" });
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
    const fileBase64 = arquivo.buffer.toString("base64");
    const filename = arquivo.originalname || "documento.pdf";
    const mimetype = arquivo.mimetype || "application/pdf";

    await db.insert(filaWhatsappTable).values({
      numero: numero,
      mensagem: mensagem || "",
      arquivoBase64: fileBase64,
      mimetype: mimetype,
      nomeArquivo: filename,
      status: "Pendente",
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao enfileirar documento WhatsApp:", err);
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

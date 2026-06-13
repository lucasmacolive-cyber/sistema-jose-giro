import { Router } from "express";
import { getWhatsAppStatus, sendWhatsAppMessage, disconnectWhatsApp, generateWhatsAppPairing } from "../lib/whatsapp-baileys.js";
import multer from "multer";

const router = Router();
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
  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ error: "Número de telefone é obrigatório para gerar o código de pareamento" });
  }
  try {
    await generateWhatsAppPairing(number);
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
    // Para simplificar, vou manter apenas o send message regular, 
    // ou poderiamos implementar envio de arquivo no Baileys.
    res.status(501).json({ error: "Envio de documento pendente de conversão para Baileys" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

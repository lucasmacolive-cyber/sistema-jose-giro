import { Router, type IRouter } from "express";
import { getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppDocument } from "../lib/whatsapp.ts";
import multer from "multer";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.get("/whatsapp/status", (req, res) => {
  const status = getWhatsAppStatus();
  res.json(status);
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

export default router;

import { Router, type IRouter } from "express";
import { getWhatsAppStatus, sendWhatsAppMessage } from "../lib/whatsapp.ts";

const router: IRouter = Router();

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

export default router;

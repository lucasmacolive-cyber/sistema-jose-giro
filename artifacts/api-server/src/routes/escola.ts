// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.js";
import { alunosTable, turmasTable, professoresTable, funcionariosTable, impressoesTable, alertasTable, configuracoesTable } from "../lib/db/index.js";
import { eq, and, not, ilike, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import multer from "multer";
import nodemailer from "nodemailer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/escola", (_req, res) => {
  res.json({
    nome: "E. M. José Giró Faísca",
    logoUrl: "https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png",
  });
});

router.get("/dashboard/stats", async (_req, res) => {
  const [totalAlunos] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    and(eq(alunosTable.arquivoMorto, 0), eq(alunosTable.situacao, "Matriculado"))
  );
  const [totalTransferidos] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    and(eq(alunosTable.arquivoMorto, 0), ilike(alunosTable.situacao, "Transferido%"))
  );
  const [totalTurmas] = await db.select({ count: sql<number>`count(*)` }).from(turmasTable);
  const [totalProfessores] = await db.select({ count: sql<number>`count(*)` }).from(professoresTable);
  const [totalFuncionarios] = await db.select({ count: sql<number>`count(*)` }).from(funcionariosTable);
  const [impressoesPendentes] = await db.select({ count: sql<number>`count(*)` }).from(impressoesTable).where(eq(impressoesTable.status, "Pendente"));
  const [alertasNaoLidos] = await db.select({ count: sql<number>`count(*)` }).from(alertasTable).where(eq(alertasTable.lido, false));

  res.json({
    totalAlunos: Number(totalAlunos.count),
    totalTransferidos: Number(totalTransferidos.count),
    totalTurmas: Number(totalTurmas.count),
    totalProfessores: Number(totalProfessores.count),
    totalFuncionarios: Number(totalFuncionarios.count),
    impressoesPendentes: Number(impressoesPendentes.count),
    alertasNaoLidos: Number(alertasNaoLidos.count),
  });
});

// GET /escola/contatos
router.get("/escola/contatos", async (_req, res) => {
  try {
    const keys = [
      "escola_email",
      "escola_telefone",
      "escola_whatsapp_grupo",
      "impressora_ricoh_ip",
      "impressora_epson_ip",
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_pass",
      "smtp_secure"
    ];
    const rows = await db.select().from(configuracoesTable).where(inArray(configuracoesTable.chave, keys));
    const result = {
      escola_email: "",
      escola_telefone: "",
      escola_whatsapp_grupo: "",
      impressora_ricoh_ip: "",
      impressora_epson_ip: "",
      smtp_host: "smtp.gmail.com",
      smtp_port: "465",
      smtp_user: "",
      smtp_pass: "",
      smtp_secure: "true"
    };
    for (const r of rows) {
      result[r.chave] = r.valor || "";
    }
    res.json(result);
  } catch (err) {
    console.error("Erro ao obter contatos:", err);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /escola/contatos
router.put("/escola/contatos", async (req, res) => {
  try {
    const updates = req.body;
    const keys = [
      "escola_email",
      "escola_telefone",
      "escola_whatsapp_grupo",
      "impressora_ricoh_ip",
      "impressora_epson_ip",
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_pass",
      "smtp_secure"
    ];
    for (const key of keys) {
      if (updates[key] !== undefined) {
        const valStr = String(updates[key]);
        await db.insert(configuracoesTable)
          .values({ chave: key, valor: valStr, atualizadoEm: new Date() })
          .onConflictDoUpdate({
            target: configuracoesTable.chave,
            set: { valor: valStr, atualizadoEm: new Date() }
          });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar contatos:", err);
    res.status(500).json({ erro: err.message });
  }
});

// POST /escola/send-email-document
router.post("/escola/send-email-document", upload.single("arquivo"), async (req, res) => {
  const { destinatario, assunto, corpo } = req.body;
  const arquivo = req.file;

  if (!destinatario || !arquivo) {
    return res.status(400).json({ erro: "Destinatário e arquivo são obrigatórios" });
  }

  try {
    // 1. Busca configurações SMTP
    const keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_secure", "escola_email"];
    const rows = await db.select().from(configuracoesTable).where(inArray(configuracoesTable.chave, keys));
    const config = {};
    for (const r of rows) {
      config[r.chave] = r.valor || "";
    }

    const host = config.smtp_host || "smtp.gmail.com";
    const port = parseInt(config.smtp_port || "465");
    const user = config.smtp_user || config.escola_email || "";
    const pass = config.smtp_pass || "";
    const secure = config.smtp_secure !== "false";
    const fromEmail = config.escola_email || user;

    if (!user || !pass) {
      return res.status(400).json({
        erro: "Servidor SMTP não configurado. Por favor, acesse os Ajustes do sistema e insira o usuário e a senha do servidor de e-mail da escola."
      });
    }

    // 2. Configura transporter do nodemailer
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      }
    });

    // 3. Envia e-mail
    await transporter.sendMail({
      from: `"E. M. José Giró Faísca" <${fromEmail}>`,
      to: destinatario,
      subject: assunto || "Documento Escolar - E. M. José Giró Faísca",
      text: corpo || "Segue em anexo o documento escolar solicitado.",
      attachments: [
        {
          filename: arquivo.originalname || "documento.pdf",
          content: arquivo.buffer
        }
      ]
    });

    res.json({ ok: true, mensagem: "E-mail enviado com sucesso!" });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    res.status(500).json({ erro: `Falha ao enviar e-mail: ${err.message}` });
  }
});

export default router;

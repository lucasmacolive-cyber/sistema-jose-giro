// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usuariosTable, alertasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) {
    res.status(400).json({ erro: "campos_obrigatorios", mensagem: "Login e senha são obrigatórios" });
    return;
  }

  const usuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.login, String(login)));
  const usuario = usuarios[0];

  if (!usuario || usuario.senha !== String(senha)) {
    // Registrar tentativa de login falha como alerta
    try {
      await db.insert(alertasTable).values({
        tipo: "login_falho",
        mensagem: `Tentativa de login com falha — usuário: "${login}"`,
        lido: false,
        dados: { login, ip: req.ip ?? "desconhecido", quando: new Date().toISOString() },
      });
    } catch { /* não bloquear o fluxo se o insert falhar */ }
    res.status(401).json({ erro: "credenciais_invalidas", mensagem: "Login ou senha incorretos." });
    return;
  }

  (req.session as any).userId = usuario.id;
  (req.session as any).perfil = usuario.perfil;

  res.json({
    sucesso: true,
    usuario: {
      id: usuario.id,
      nomeCompleto: usuario.nomeCompleto,
      login: usuario.login,
      perfil: usuario.perfil,
      genero: usuario.genero,
    },
  });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ erro: "nao_autenticado", mensagem: "Não autenticado" });
    return;
  }

  const usuarios = await db.select().from(usuariosTable).where(eq(usuariosTable.id, userId));
  const usuario = usuarios[0];

  if (!usuario) {
    res.status(401).json({ erro: "usuario_nao_encontrado", mensagem: "Usuário não encontrado" });
    return;
  }

  res.json({
    id: usuario.id,
    nomeCompleto: usuario.nomeCompleto,
    login: usuario.login,
    perfil: usuario.perfil,
    genero: usuario.genero,
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ sucesso: true });
  });
});

export default router;

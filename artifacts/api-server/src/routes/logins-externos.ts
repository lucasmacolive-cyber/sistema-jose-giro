// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "../lib/db/index.ts";
import { loginsExternos } from "../lib/db/index.ts/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /logins-externos
router.get("/logins-externos", async (req: Request, res: Response) => {
  try {
    const lista = await db.select().from(loginsExternos).orderBy(loginsExternos.nomeSite);
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar logins" });
  }
});

// POST /logins-externos
router.post("/logins-externos", async (req: Request, res: Response) => {
  try {
    const { nomeSite, url, login, senha, descricao } = req.body;
    if (!nomeSite || !login || !senha) {
      res.status(400).json({ error: "nomeSite, login e senha são obrigatórios" });
      return;
    }
    const [novo] = await db.insert(loginsExternos).values({ nomeSite, url, login, senha, descricao }).returning();
    res.status(201).json(novo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar login" });
  }
});

// PUT /logins-externos/:id
router.put("/logins-externos/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { nomeSite, url, login, senha, descricao } = req.body;
    const [atualizado] = await db
      .update(loginsExternos)
      .set({ nomeSite, url, login, senha, descricao, atualizadoEm: new Date() })
      .where(eq(loginsExternos.id, id))
      .returning();
    if (!atualizado) { res.status(404).json({ error: "Login não encontrado" }); return; }
    res.json(atualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar login" });
  }
});

// DELETE /logins-externos/:id
router.delete("/logins-externos/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(loginsExternos).where(eq(loginsExternos.id, Number(req.params.id)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao remover login" });
  }
});

export default router;

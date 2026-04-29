import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { professoresTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/professores", async (_req, res) => {
  const professores = await db.select().from(professoresTable).orderBy(professoresTable.nome);
  res.json(professores);
});

router.get("/professores/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  const professores = await db.select().from(professoresTable).where(eq(professoresTable.id, id));
  if (!professores[0]) { res.status(404).json({ erro: "nao_encontrado", mensagem: "Professor não encontrado" }); return; }
  res.json(professores[0]);
});

export default router;

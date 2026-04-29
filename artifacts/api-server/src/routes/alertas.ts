// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index";
import { alertasTable } from "../lib/db/index";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/alertas", async (_req, res) => {
  const alertas = await db.select().from(alertasTable).orderBy(desc(alertasTable.criadoEm));
  res.json(alertas);
});

router.patch("/alertas/:id/lido", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  await db.update(alertasTable).set({ lido: true }).where(eq(alertasTable.id, id));
  res.json({ sucesso: true });
});

router.delete("/alertas/lidos", async (_req, res) => {
  await db.delete(alertasTable).where(eq(alertasTable.lido, true));
  res.json({ sucesso: true });
});

export default router;

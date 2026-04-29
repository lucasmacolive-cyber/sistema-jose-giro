import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { funcionariosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/funcionarios", async (_req, res) => {
  const funcionarios = await db.select().from(funcionariosTable).orderBy(funcionariosTable.nomeCompleto);
  res.json(funcionarios);
});

router.get("/funcionarios/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  const funcionarios = await db.select().from(funcionariosTable).where(eq(funcionariosTable.id, id));
  if (!funcionarios[0]) { res.status(404).json({ erro: "nao_encontrado", mensagem: "Funcionário não encontrado" }); return; }
  res.json(funcionarios[0]);
});

export default router;

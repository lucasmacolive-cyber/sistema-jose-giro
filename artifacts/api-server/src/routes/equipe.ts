// @ts-nocheck
import { Router } from "express";
import { db, professores, funcionarios } from "@workspace/db";

const router = Router();

// Listar professores
router.get("/professores", async (req, res) => {
  try {
    const lista = await db.select().from(professores);
    res.json(lista);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar professores" });
  }
});

// Listar funcionários
router.get("/funcionarios", async (req, res) => {
  try {
    const lista = await db.select().from(funcionarios);
    res.json(lista);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar funcionários" });
  }
});

export default router;

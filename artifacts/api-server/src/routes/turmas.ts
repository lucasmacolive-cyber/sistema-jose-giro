// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index.ts";
import { turmasTable, alunosTable } from "../lib/db/index.ts/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/turmas", async (req, res) => {
  const turmas = await db.select().from(turmasTable).orderBy(turmasTable.nomeTurma);

  const turmasComCount = await Promise.all(
    turmas.map(async (turma) => {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(alunosTable)
        .where(and(eq(alunosTable.turmaAtual, turma.nomeTurma), eq(alunosTable.arquivoMorto, 0)));
      return { ...turma, totalAlunos: Number(result[0]?.count ?? 0) };
    })
  );

  res.json(turmasComCount);
});

router.get("/turmas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  const turmas = await db.select().from(turmasTable).where(eq(turmasTable.id, id));
  if (!turmas[0]) { res.status(404).json({ erro: "nao_encontrado", mensagem: "Turma não encontrada" }); return; }

  const alunos = await db.select().from(alunosTable)
    .where(and(eq(alunosTable.turmaAtual, turmas[0].nomeTurma), eq(alunosTable.arquivoMorto, 0)))
    .orderBy(alunosTable.nomeCompleto);

  res.json({ ...turmas[0], alunos });
});

router.patch("/turmas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  const { linkSuap, professorResponsavel, cor, turno } = req.body;
  const updates: any = {};
  if (linkSuap !== undefined) updates.linkSuap = linkSuap;
  if (professorResponsavel !== undefined) updates.professorResponsavel = professorResponsavel;
  if (cor !== undefined) updates.cor = cor;
  if (turno !== undefined) updates.turno = turno;

  const [atualizada] = await db.update(turmasTable)
    .set(updates)
    .where(eq(turmasTable.id, id))
    .returning();
    
  if (!atualizada) {
    res.status(404).json({ erro: "nao_encontrada", mensagem: "Turma não encontrada" });
    return;
  }
  res.json(atualizada);
});

export default router;

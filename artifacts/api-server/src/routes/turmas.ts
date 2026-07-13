// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.js";
import { turmasTable, alunosTable } from "../lib/db/index.js";
import { eq, and, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/turmas", async (req, res) => {
  const turmas = await db.select().from(turmasTable).orderBy(turmasTable.nomeTurma);

  const { professoresTable } = await import("../lib/db/index.js");

  const turmasComCount = await Promise.all(
    turmas.map(async (turma) => {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(alunosTable)
        .where(and(eq(alunosTable.turmaAtual, turma.nomeTurma), eq(alunosTable.arquivoMorto, 0)));
      
      const profs = await db.select({ nome: professoresTable.nome })
        .from(professoresTable)
        .where(
          or(
            eq(professoresTable.turmaManha, turma.nomeTurma),
            eq(professoresTable.turmaTarde, turma.nomeTurma)
          )
        );
      const professorResponsavel = turma.professorResponsavel || (profs.length > 0 ? profs.map(p => p.nome).join(", ") : null);

      return { 
        ...turma, 
        professorResponsavel,
        totalAlunos: Number(result[0]?.count ?? 0) 
      };
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

router.post("/turmas", async (req, res) => {
  try {
    const { nomeTurma, turno, professorResponsavel, cor, linkSuap } = req.body;
    if (!nomeTurma) {
      res.status(400).json({ erro: "dados_incompletos", mensagem: "Nome da turma é obrigatório" });
      return;
    }
    const [nova] = await db.insert(turmasTable).values({
      nomeTurma,
      turno: turno || "Manhã",
      professorResponsavel: professorResponsavel || null,
      cor: cor || "#3b82f6",
      linkSuap: linkSuap || null
    }).returning();
    res.json(nova);
  } catch (e: any) {
    res.status(500).json({ erro: "erro_servidor", mensagem: e.message });
  }
});

router.patch("/turmas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  try {
    const { linkSuap, professorResponsavel, cor, turno, nomeTurma } = req.body;
    const updates: any = {};
    if (linkSuap !== undefined) updates.linkSuap = linkSuap;
    if (professorResponsavel !== undefined) updates.professorResponsavel = professorResponsavel;
    if (cor !== undefined) updates.cor = cor;
    if (turno !== undefined) updates.turno = turno;
    if (nomeTurma !== undefined) updates.nomeTurma = nomeTurma;

    let nomeAntigo = "";
    if (nomeTurma) {
      const [t] = await db.select().from(turmasTable).where(eq(turmasTable.id, id)).limit(1);
      if (t) nomeAntigo = t.nomeTurma;
    }

    const [atualizada] = await db.update(turmasTable)
      .set(updates)
      .where(eq(turmasTable.id, id))
      .returning();
      
    if (!atualizada) {
      res.status(404).json({ erro: "nao_encontrada", mensagem: "Turma não encontrada" });
      return;
    }

    if (nomeTurma && nomeAntigo && nomeAntigo !== nomeTurma) {
      await db.update(alunosTable)
        .set({ turmaAtual: nomeTurma })
        .where(eq(alunosTable.turmaAtual, nomeAntigo));
    }

    res.json(atualizada);
  } catch (e: any) {
    res.status(500).json({ erro: "erro_servidor", mensagem: e.message });
  }
});

router.delete("/turmas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  try {
    const [deletada] = await db.delete(turmasTable).where(eq(turmasTable.id, id)).returning();
    if (!deletada) {
      res.status(404).json({ erro: "nao_encontrada", mensagem: "Turma não encontrada" });
      return;
    }
    res.json({ ok: true, deletada });
  } catch (e: any) {
    res.status(500).json({ erro: "erro_servidor", mensagem: e.message });
  }
});

export default router;

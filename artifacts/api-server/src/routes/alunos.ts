// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { alunosTable } from "@workspace/db/schema";
import { eq, ilike, or, and, isNotNull, ne } from "drizzle-orm";

const router: IRouter = Router();

router.get("/alunos", async (req, res) => {
  const { turma, busca, status, transferidos } = req.query;
  let conditions: any[] = [eq(alunosTable.arquivoMorto, 0)];

  if (transferidos === "true") {
    // Alunos com qualquer tipo de transferência registrada
    conditions.push(isNotNull(alunosTable.tipoTransferencia));
  } else {
    if (turma) conditions.push(eq(alunosTable.turmaAtual, String(turma)));
  }

  if (busca) {
    const termo = `%${busca}%`;
    conditions.push(or(
      ilike(alunosTable.nomeCompleto, termo),
      ilike(alunosTable.matricula, termo)
    ));
  }

  const alunos = await db.select().from(alunosTable).where(and(...conditions)).orderBy(alunosTable.nomeCompleto);
  res.json(alunos);
});

router.get("/alunos/transferidos", async (_req, res) => {
  const transferidos = await db.select({
    id: alunosTable.id,
    nomeCompleto: alunosTable.nomeCompleto,
    turmaAtual: alunosTable.turmaAtual,
    situacao: alunosTable.situacao,
    dataTransferencia: alunosTable.dataTransferencia,
    tipoTransferencia: alunosTable.tipoTransferencia,
    turmaDestino: alunosTable.turmaDestino,
  })
  .from(alunosTable)
  .where(and(eq(alunosTable.arquivoMorto, 0), ilike(alunosTable.situacao, "Transferido%")))
  .orderBy(alunosTable.turmaAtual, alunosTable.nomeCompleto);
  res.json(transferidos);
});

router.get("/alunos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ erro: "id_invalido", mensagem: "ID inválido" }); return; }

  const alunos = await db.select().from(alunosTable).where(eq(alunosTable.id, id));
  if (!alunos[0]) { res.status(404).json({ erro: "nao_encontrado", mensagem: "Aluno não encontrado" }); return; }
  res.json(alunos[0]);
});

export default router;

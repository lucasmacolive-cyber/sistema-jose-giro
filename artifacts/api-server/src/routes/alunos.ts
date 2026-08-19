// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.js";
import { alunosTable } from "../lib/db/index.js";
import { eq, ilike, or, and, isNotNull, isNull, ne } from "drizzle-orm";

const router = Router();

router.get("/alunos", async (req, res) => {
  const { turma, busca, status, transferidos } = req.query;
  let conditions: any[] = [];

  if (transferidos === "true") {
    conditions.push(isNotNull(alunosTable.tipoTransferencia));
  } else {
    conditions.push(or(eq(alunosTable.arquivoMorto, 0), isNull(alunosTable.arquivoMorto)));
    if (turma) conditions.push(eq(alunosTable.turmaAtual, String(turma)));
  }

  if (busca) {
    const termo = `%${busca}%`;
    conditions.push(or(
      ilike(alunosTable.nomeCompleto, termo),
      ilike(alunosTable.matricula, termo)
    ));
  }

  let alunos = await db.select().from(alunosTable).where(and(...conditions)).orderBy(alunosTable.nomeCompleto);
  if (alunos.length === 0 && !busca && !turma && transferidos !== "true") {
    alunos = await db.select().from(alunosTable).orderBy(alunosTable.nomeCompleto);
  }
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
  .where(and(eq(alunosTable.arquivoMorto, 0), isNotNull(alunosTable.tipoTransferencia)))
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

router.patch("/alunos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ ok: false, mensagem: "ID inválido" });
  try {
    const { turmaAtual, situacao, arquivoMorto } = req.body;
    const updates: any = {};
    if (turmaAtual !== undefined) updates.turmaAtual = turmaAtual;
    if (situacao !== undefined) {
      updates.situacao = situacao;
      if (situacao === "Matriculado") {
        updates.arquivoMorto = 0;
        updates.motivoSaida = null;
        updates.dataSaida = null;
        updates.dataTransferencia = null;
        updates.tipoTransferencia = null;
      }
    }
    if (arquivoMorto !== undefined) {
      updates.arquivoMorto = arquivoMorto;
      if (arquivoMorto === 0 && !updates.situacao) {
        updates.situacao = "Matriculado";
        updates.motivoSaida = null;
        updates.dataSaida = null;
        updates.dataTransferencia = null;
        updates.tipoTransferencia = null;
      }
    }

    const [atualizado] = await db.update(alunosTable)
      .set(updates)
      .where(eq(alunosTable.id, id))
      .returning();

    if (!atualizado) return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado" });
    res.json({ ok: true, aluno: atualizado });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

export default router;

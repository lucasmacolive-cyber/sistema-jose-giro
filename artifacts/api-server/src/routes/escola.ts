// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { alunosTable, turmasTable, professoresTable, funcionariosTable, impressoesTable, alertasTable } from "@workspace/db/schema";
import { eq, and, not, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/escola", (_req, res) => {
  res.json({
    nome: "E. M. José Giró Faísca",
    logoUrl: "https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png",
  });
});

router.get("/dashboard/stats", async (_req, res) => {
  const [totalAlunos] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    and(eq(alunosTable.arquivoMorto, 0), eq(alunosTable.situacao, "Matriculado"))
  );
  const [totalTransferidos] = await db.select({ count: sql<number>`count(*)` }).from(alunosTable).where(
    and(eq(alunosTable.arquivoMorto, 0), ilike(alunosTable.situacao, "Transferido%"))
  );
  const [totalTurmas] = await db.select({ count: sql<number>`count(*)` }).from(turmasTable);
  const [totalProfessores] = await db.select({ count: sql<number>`count(*)` }).from(professoresTable);
  const [totalFuncionarios] = await db.select({ count: sql<number>`count(*)` }).from(funcionariosTable);
  const [impressoesPendentes] = await db.select({ count: sql<number>`count(*)` }).from(impressoesTable).where(eq(impressoesTable.status, "Pendente"));
  const [alertasNaoLidos] = await db.select({ count: sql<number>`count(*)` }).from(alertasTable).where(eq(alertasTable.lido, false));

  res.json({
    totalAlunos: Number(totalAlunos.count),
    totalTransferidos: Number(totalTransferidos.count),
    totalTurmas: Number(totalTurmas.count),
    totalProfessores: Number(totalProfessores.count),
    totalFuncionarios: Number(totalFuncionarios.count),
    impressoesPendentes: Number(impressoesPendentes.count),
    alertasNaoLidos: Number(alertasNaoLidos.count),
  });
});


export default router;

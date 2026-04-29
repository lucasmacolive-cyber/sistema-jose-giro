// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../../lib/db/src/index.ts";
import { notasTable, presencasTable, alunosTable } from "../../lib/db/src/index.ts/schema";
import { eq, and, sql } from "drizzle-orm";

const router: IRouter = Router();

/* GET /api/notas/:alunoId — notas de um aluno agrupadas por bimestre */
router.get("/notas/:alunoId", async (req, res) => {
  const alunoId = parseInt(req.params.alunoId);
  if (isNaN(alunoId)) { res.status(400).json({ mensagem: "ID inválido" }); return; }

  const notas = await db
    .select()
    .from(notasTable)
    .where(eq(notasTable.alunoId, alunoId))
    .orderBy(notasTable.bimestre, notasTable.disciplina);

  // Agrupar por bimestre
  const porBimestre: Record<number, typeof notas> = { 1: [], 2: [], 3: [], 4: [] };
  notas.forEach((n) => { if (n.bimestre && porBimestre[n.bimestre]) porBimestre[n.bimestre].push(n); });

  res.json({ porBimestre, total: notas.length });
});

/* GET /api/presencas/:alunoId — presenças de um aluno agrupadas por bimestre */
router.get("/presencas/:alunoId", async (req, res) => {
  const alunoId = parseInt(req.params.alunoId);
  if (isNaN(alunoId)) { res.status(400).json({ mensagem: "ID inválido" }); return; }

  const presencas = await db
    .select()
    .from(presencasTable)
    .where(eq(presencasTable.alunoId, alunoId))
    .orderBy(presencasTable.bimestre, presencasTable.disciplina);

  // Agrupar por bimestre
  const porBimestre: Record<number, typeof presencas> = { 1: [], 2: [], 3: [], 4: [] };
  presencas.forEach((p) => { if (p.bimestre && porBimestre[p.bimestre]) porBimestre[p.bimestre].push(p); });

  res.json({ porBimestre, total: presencas.length });
});

/* GET /api/notas-presencas/alunos — lista de alunos com dados de notas/presenças */
router.get("/notas-presencas/alunos", async (req, res) => {
  const { search, turma } = req.query;

  const alunos = await db.execute(sql`
    SELECT
      a.id,
      a.matricula,
      a.nome_completo,
      a.turma_atual,
      a.turno,
      a.situacao,
      (SELECT COUNT(*) FROM notas n WHERE n.aluno_id = a.id) AS total_notas,
      (SELECT COUNT(*) FROM presencas p WHERE p.aluno_id = a.id) AS total_presencas,
      (SELECT MAX(n2.data_atualizacao) FROM notas n2 WHERE n2.aluno_id = a.id) AS ultima_nota
    FROM alunos a
    WHERE a.arquivo_morto = 0
      AND (${!search ? sql`TRUE` : sql`a.nome_completo ILIKE ${'%' + search + '%'}`})
      AND (${!turma ? sql`TRUE` : sql`a.turma_atual = ${turma}`})
    ORDER BY a.nome_completo
    LIMIT 200
  `);

  res.json({ alunos: alunos.rows });
});

/* POST /api/notas — inserir/atualizar nota */
router.post("/notas", async (req, res) => {
  const { alunoId, bimestre, disciplina, nota1, nota2, notaFinal, mediaFinal, situacao } = req.body;
  if (!alunoId || !bimestre || !disciplina) {
    res.status(400).json({ mensagem: "alunoId, bimestre e disciplina são obrigatórios" });
    return;
  }

  const existing = await db
    .select()
    .from(notasTable)
    .where(and(
      eq(notasTable.alunoId, alunoId),
      eq(notasTable.bimestre, bimestre),
      eq(notasTable.disciplina, disciplina)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(notasTable)
      .set({ nota1, nota2, notaFinal, mediaFinal, situacao, dataAtualizacao: new Date() })
      .where(eq(notasTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(notasTable)
      .values({ alunoId, bimestre, disciplina, nota1, nota2, notaFinal, mediaFinal, situacao })
      .returning();
    res.json(created);
  }
});

/* POST /api/presencas — inserir/atualizar presença */
router.post("/presencas", async (req, res) => {
  const { alunoId, bimestre, disciplina, totalAulas, faltas, percentualFrequencia } = req.body;
  if (!alunoId || !bimestre || !disciplina) {
    res.status(400).json({ mensagem: "alunoId, bimestre e disciplina são obrigatórios" });
    return;
  }

  const freqCalc = totalAulas > 0
    ? (((totalAulas - (faltas ?? 0)) / totalAulas) * 100).toFixed(2)
    : percentualFrequencia ?? "0";

  const existing = await db
    .select()
    .from(presencasTable)
    .where(and(
      eq(presencasTable.alunoId, alunoId),
      eq(presencasTable.bimestre, bimestre),
      eq(presencasTable.disciplina, disciplina)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(presencasTable)
      .set({ totalAulas, faltas, percentualFrequencia: freqCalc, dataAtualizacao: new Date() })
      .where(eq(presencasTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(presencasTable)
      .values({ alunoId, bimestre, disciplina, totalAulas, faltas, percentualFrequencia: freqCalc })
      .returning();
    res.json(created);
  }
});

export default router;

// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.js";
import { notasTable, presencasTable, alunosTable } from "../lib/db/index.js";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

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
      (SELECT ROUND(AVG(COALESCE(n.media_final, n.nota_final, n.nota_1))::numeric, 1) FROM notas n WHERE n.aluno_id = a.id AND COALESCE(n.media_final, n.nota_final, n.nota_1) IS NOT NULL) AS media_geral,
      (SELECT COUNT(*) FROM presencas p WHERE p.aluno_id = a.id) AS total_presencas,
      (SELECT COUNT(*) FROM diario_presencas dp INNER JOIN diario_aulas da ON da.id = dp.aula_id WHERE dp.aluno_id = a.id AND COALESCE(da.tipo, 'normal') NOT IN ('feriado', 'recesso')) AS total_diario_aulas,
      (SELECT COUNT(*) FROM diario_presencas dp INNER JOIN diario_aulas da ON da.id = dp.aula_id WHERE dp.aluno_id = a.id AND dp.status = 'F' AND COALESCE(da.tipo, 'normal') NOT IN ('feriado', 'recesso')) AS total_diario_faltas,
      (SELECT MAX(n2.data_atualizacao) FROM notas n2 WHERE n2.aluno_id = a.id) AS ultima_nota
    FROM alunos a
    WHERE a.arquivo_morto = 0
      AND (${!search ? sql`TRUE` : sql`a.nome_completo ILIKE ${'%' + search + '%'}`})
      AND (${!turma ? sql`TRUE` : sql`a.turma_atual = ${turma}`})
    ORDER BY a.nome_completo
  `);

  res.json({ alunos: alunos.rows });
});

function parseDecimalNota(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(String(val).replace(",", "."));
  if (!Number.isFinite(num)) return null;
  const clamped = Math.min(10, Math.max(0, num));
  return clamped.toFixed(2);
}

/* POST /api/notas — inserir/atualizar nota */
router.post("/notas", async (req, res) => {
  const { alunoId, bimestre, disciplina, nota1, nota2, notaFinal, mediaFinal, situacao } = req.body ?? {};
  const alunoIdNum = Number(alunoId);
  const bimNum = Number(bimestre);
  const discStr = typeof disciplina === "string" ? disciplina.trim() : "";

  if (!alunoIdNum || !bimNum || bimNum < 1 || bimNum > 4 || !discStr) {
    res.status(400).json({ mensagem: "alunoId, bimestre (1..4) e disciplina são obrigatórios" });
    return;
  }

  const n1 = parseDecimalNota(nota1);
  const n2 = parseDecimalNota(nota2);
  let nFinal = parseDecimalNota(notaFinal);
  let mFinal = parseDecimalNota(mediaFinal);

  const vals: number[] = [];
  if (n1 !== null) vals.push(Number(n1));
  if (n2 !== null) vals.push(Number(n2));
  if (vals.length > 0) {
    const calc = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    if (nFinal === null) nFinal = calc;
    if (mFinal === null) mFinal = nFinal;
  } else if (mFinal === null && nFinal !== null) {
    mFinal = nFinal;
  }

  const refNota = mFinal ?? nFinal ?? n1;
  const situacaoFinal =
    typeof situacao === "string" && situacao.trim()
      ? situacao.trim()
      : refNota === null
      ? "Cursando"
      : Number(refNota) >= 6
      ? "Aprovado"
      : "Em Recuperação";

  const existing = await db
    .select()
    .from(notasTable)
    .where(and(
      eq(notasTable.alunoId, alunoIdNum),
      eq(notasTable.bimestre, bimNum),
      eq(notasTable.disciplina, discStr)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(notasTable)
      .set({
        nota1: n1,
        nota2: n2,
        notaFinal: nFinal,
        mediaFinal: mFinal,
        situacao: situacaoFinal,
        dataAtualizacao: new Date(),
      })
      .where(eq(notasTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(notasTable)
      .values({
        alunoId: alunoIdNum,
        bimestre: bimNum,
        disciplina: discStr,
        nota1: n1,
        nota2: n2,
        notaFinal: nFinal,
        mediaFinal: mFinal,
        situacao: situacaoFinal,
      })
      .returning();
    res.json(created);
  }
});

/* POST /api/presencas — inserir/atualizar presença */
router.post("/presencas", async (req, res) => {
  const { alunoId, bimestre, disciplina, totalAulas, faltas, percentualFrequencia } = req.body ?? {};
  const alunoIdNum = Number(alunoId);
  const bimNum = Number(bimestre);
  const discStr = typeof disciplina === "string" ? disciplina.trim() : "";

  if (!alunoIdNum || !bimNum || bimNum < 1 || bimNum > 4 || !discStr) {
    res.status(400).json({ mensagem: "alunoId, bimestre (1..4) e disciplina são obrigatórios" });
    return;
  }

  const totalNum = Math.max(0, Math.round(Number(totalAulas) || 0));
  const faltasNum = Math.max(0, Math.round(Number(faltas) || 0));

  const freqCalc = totalNum > 0
    ? Math.min(100, Math.max(0, ((totalNum - faltasNum) / totalNum) * 100)).toFixed(2)
    : Math.min(100, Math.max(0, Number(String(percentualFrequencia ?? "0").replace(",", ".")) || 0)).toFixed(2);

  const existing = await db
    .select()
    .from(presencasTable)
    .where(and(
      eq(presencasTable.alunoId, alunoIdNum),
      eq(presencasTable.bimestre, bimNum),
      eq(presencasTable.disciplina, discStr)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(presencasTable)
      .set({
        totalAulas: totalNum,
        faltas: faltasNum,
        percentualFrequencia: freqCalc,
        dataAtualizacao: new Date(),
      })
      .where(eq(presencasTable.id, existing[0].id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(presencasTable)
      .values({
        alunoId: alunoIdNum,
        bimestre: bimNum,
        disciplina: discStr,
        totalAulas: totalNum,
        faltas: faltasNum,
        percentualFrequencia: freqCalc,
      })
      .returning();
    res.json(created);
  }
});

export default router;

// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "../lib/db/index.ts";
import { arquivoMorto, arquivoMortoDocumentos } from "../lib/db/index.ts/schema";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /arquivo-morto — listar todos com contagem de documentos
router.get("/arquivo-morto", async (req: Request, res: Response) => {
  try {
    const lista = await db
      .select({
        id: arquivoMorto.id,
        nomeAluno: arquivoMorto.nomeAluno,
        matricula: arquivoMorto.matricula,
        anoSaida: arquivoMorto.anoSaida,
        turma: arquivoMorto.turma,
        observacoes: arquivoMorto.observacoes,
        criadoEm: arquivoMorto.criadoEm,
        totalDocumentos: sql<number>`(
          SELECT COUNT(*) FROM arquivo_morto_documentos
          WHERE arquivo_morto_id = ${arquivoMorto.id}
        )`.as("total_documentos"),
      })
      .from(arquivoMorto)
      .orderBy(arquivoMorto.nomeAluno);

    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar arquivo morto" });
  }
});

// POST /arquivo-morto — criar aluno
router.post("/arquivo-morto", async (req: Request, res: Response) => {
  try {
    const { nomeAluno, matricula, anoSaida, turma, observacoes } = req.body;
    if (!nomeAluno) {
      res.status(400).json({ error: "nomeAluno é obrigatório" });
      return;
    }

    const [novo] = await db
      .insert(arquivoMorto)
      .values({ nomeAluno, matricula, anoSaida, turma, observacoes })
      .returning();

    res.status(201).json(novo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar registro" });
  }
});

// GET /arquivo-morto/:id — aluno com documentos
router.get("/arquivo-morto/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [aluno] = await db
      .select()
      .from(arquivoMorto)
      .where(eq(arquivoMorto.id, id));

    if (!aluno) {
      res.status(404).json({ error: "Aluno não encontrado" });
      return;
    }

    const docs = await db
      .select()
      .from(arquivoMortoDocumentos)
      .where(eq(arquivoMortoDocumentos.arquivoMortoId, id))
      .orderBy(arquivoMortoDocumentos.criadoEm);

    res.json({ ...aluno, documentos: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter aluno" });
  }
});

// DELETE /arquivo-morto/:id — remover aluno (cascata remove docs)
router.delete("/arquivo-morto/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(arquivoMorto).where(eq(arquivoMorto.id, id));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao remover aluno" });
  }
});

// POST /arquivo-morto/:id/documentos — adicionar documento
router.post("/arquivo-morto/:id/documentos", async (req: Request, res: Response) => {
  try {
    const arquivoMortoId = Number(req.params.id);
    const { nomeArquivo, objectPath, tamanhoBytes } = req.body;

    if (!nomeArquivo || !objectPath) {
      res.status(400).json({ error: "nomeArquivo e objectPath são obrigatórios" });
      return;
    }

    const [doc] = await db
      .insert(arquivoMortoDocumentos)
      .values({
        arquivoMortoId,
        nomeArquivo,
        objectPath,
        contentType: "application/pdf",
        tamanhoBytes,
      })
      .returning();

    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar documento" });
  }
});

// DELETE /arquivo-morto/documentos/:docId — remover documento
router.delete("/arquivo-morto/documentos/:docId", async (req: Request, res: Response) => {
  try {
    const docId = Number(req.params.docId);
    await db.delete(arquivoMortoDocumentos).where(eq(arquivoMortoDocumentos.id, docId));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao remover documento" });
  }
});

export default router;

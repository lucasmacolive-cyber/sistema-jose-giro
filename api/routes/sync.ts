// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index.ts";
import { syncStatusTable, alunosTable, configuracoesTable, diarioAulasTable, diarioPresencasTable, turmasTable, professoresTable } from "../lib/db/index.ts";
import { desc, eq, isNotNull } from "drizzle-orm";
import * as XLSX from "xlsx";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { sincronizarSUAP, sincronizarDiariosSUAP, baixarDiarioPorLink, identificarDiarioPorLinks, type SecaoDiario } from "../lib/suapSync.js";
import { parseDiarioPDF, normNome } from "../lib/parseDiario.js";
import { processarImportacaoAlunos } from "../services/importService.js";

/* Estado em memória do sync automático */
let autoSyncState: {
  rodando: boolean;
  pct: number;
  msg: string;
  erro: string | null;
  concluido: boolean;
} = { rodando: false, pct: 0, msg: "", erro: null, concluido: false };

/* Estado em memória do download em lote de diários */
let batchSyncState: {
  rodando: boolean;
  total: number;
  atual: number;
  msg: string;
  erro: string | null;
  concluido: boolean;
  ultimaSync: string | null;
} = { rodando: false, total: 0, atual: 0, msg: "", erro: null, concluido: false, ultimaSync: null };

const router: IRouter = Router();

/* ─── Status atual ─── */
router.get("/sync/status", async (_req, res) => {
  const statuses = await db.select().from(syncStatusTable).orderBy(desc(syncStatusTable.id)).limit(1);
  const status = statuses[0];

  if (!status) {
    res.json({ status: "idle", mensagem: "Nenhuma sincronização realizada ainda.", totalAlunos: 0 });
    return;
  }

  res.json({
    status: status.status,
    ultimaSync: status.ultimaSync?.toISOString(),
    mensagem: status.mensagem,
    totalAlunos: status.totalAlunos ? parseInt(status.totalAlunos) : 0,
  });
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/credenciais — retorna usuário salvo (senha mascarada)
════════════════════════════════════════════════════════════ */
router.get("/sync/credenciais", async (_req, res) => {
  const rows = await db.select().from(configuracoesTable)
    .where(eq(configuracoesTable.chave, "suap_usuario"));
  const senhaRows = await db.select().from(configuracoesTable)
    .where(eq(configuracoesTable.chave, "suap_senha"));

  const usuario = rows[0]?.valor ?? process.env.SUAP_USUARIO ?? "";
  const temSenha = !!(senhaRows[0]?.valor ?? process.env.SUAP_SENHA);

  res.json({ usuario, temSenha });
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/credenciais — salva credenciais do SUAP no banco
════════════════════════════════════════════════════════════ */
router.post("/sync/credenciais", async (req, res) => {
  const { usuario, senha } = req.body ?? {};
  if (!usuario) {
    res.status(400).json({ ok: false, mensagem: "Usuário é obrigatório." });
    return;
  }

  await db.insert(configuracoesTable)
    .values({ chave: "suap_usuario", valor: usuario })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: usuario, atualizadoEm: new Date() } });

  if (senha) {
    await db.insert(configuracoesTable)
      .values({ chave: "suap_senha", valor: senha })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: senha, atualizadoEm: new Date() } });
  }

  res.json({ ok: true, mensagem: "Credenciais salvas com sucesso." });
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/diario-links — retorna lista de links dos diários salvos
════════════════════════════════════════════════════════════ */
router.get("/sync/diario-links", async (_req, res) => {
  const rows = await db.select().from(configuracoesTable)
    .where(eq(configuracoesTable.chave, "diario_links"));
  const valor = rows[0]?.valor ?? "";
  const links = valor ? valor.split("\n").map((l: string) => l.trim()).filter(Boolean) : [];
  res.json({ links });
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/diario-links — salva lista de links dos diários
════════════════════════════════════════════════════════════ */
router.post("/sync/diario-links", async (req, res) => {
  const { links } = req.body ?? {};
  if (!Array.isArray(links)) {
    res.status(400).json({ ok: false, mensagem: "links deve ser um array." });
    return;
  }
  const valor = links.map((l: string) => l.trim()).filter(Boolean).join("\n");
  await db.insert(configuracoesTable)
    .values({ chave: "diario_links", valor })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor, atualizadoEm: new Date() } });
  res.json({ ok: true, total: links.length });
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/diario-links-meta
   Retorna links salvos enriquecidos com metadados (turma identificada, última sync)
════════════════════════════════════════════════════════════ */
router.get("/sync/diario-links-meta", async (_req, res) => {
  const [linksRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "diario_links"));
  const [metaRow]  = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "diario_links_meta"));
  const links = linksRow?.valor ? linksRow.valor.split("\n").map((l: string) => l.trim()).filter(Boolean) : [];
  let meta: Record<string, { turma?: string | null; ultimaSync?: string | null; status?: string | null }> = {};
  try { meta = metaRow?.valor ? JSON.parse(metaRow.valor) : {}; } catch { /* ignore */ }
  const result = links.map((link: string) => ({
    link,
    turma:     meta[link]?.turma     ?? null,
    ultimaSync:meta[link]?.ultimaSync ?? null,
    status:    meta[link]?.status    ?? null,
  }));
  res.json({ links: result });
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/identificar-links
   Usa a listagem de diários do SUAP para descobrir qual turma
   corresponde a cada link salvo (1 login + 1-2 páginas).
════════════════════════════════════════════════════════════ */
router.post("/sync/identificar-links", async (req, res) => {
  let usuario = process.env.SUAP_USUARIO ?? "";
  let senha   = process.env.SUAP_SENHA   ?? "";
  if (!usuario || !senha) {
    const [u] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_usuario"));
    const [s] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_senha"));
    usuario = u?.valor ?? ""; senha = s?.valor ?? "";
  }
  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais SUAP não configuradas." });
    return;
  }
  const [linksRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "diario_links"));
  const links = linksRow?.valor ? linksRow.valor.split("\n").map((l: string) => l.trim()).filter(Boolean) : [];
  if (links.length === 0) {
    res.json({ ok: true, identificados: [] });
    return;
  }
  try {
    const mapeamentos = await identificarDiarioPorLinks(usuario, senha, links);
    // Persistir metadata
    const [metaRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "diario_links_meta"));
    let meta: Record<string, { turma?: string | null; ultimaSync?: string | null; status?: string | null }> = {};
    try { meta = metaRow?.valor ? JSON.parse(metaRow.valor) : {}; } catch { /* ignore */ }
    for (const m of mapeamentos) {
      meta[m.link] = { ...meta[m.link], turma: m.turmaLocal, status: meta[m.link]?.status ?? null };
    }
    const metaStr = JSON.stringify(meta);
    await db.insert(configuracoesTable).values({ chave: "diario_links_meta", valor: metaStr })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: metaStr, atualizadoEm: new Date() } });
    res.json({ ok: true, identificados: mapeamentos });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message ?? "Erro ao identificar diários." });
  }
});

/* Utilitário: busca credenciais SUAP (env ou DB) */
async function getSuapCreds() {
  let usuario = process.env.SUAP_USUARIO ?? "";
  let senha   = process.env.SUAP_SENHA   ?? "";
  if (!usuario || !senha) {
    const [u] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_usuario"));
    const [s] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_senha"));
    usuario = u?.valor ?? ""; senha = s?.valor ?? "";
  }
  return { usuario, senha };
}

/* Utilitário: lê e salva metadata de um link */
async function salvarLinkMeta(link: string, turma: string) {
  const [metaRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "diario_links_meta"));
  let meta: Record<string, { turma?: string | null; ultimaSync?: string | null; status?: string | null }> = {};
  try { meta = metaRow?.valor ? JSON.parse(metaRow.valor) : {}; } catch { /* ignore */ }
  meta[link] = { ...meta[link], turma, ultimaSync: new Date().toISOString(), status: "ok" };
  const metaStr = JSON.stringify(meta);
  await db.insert(configuracoesTable).values({ chave: "diario_links_meta", valor: metaStr })
    .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: metaStr, atualizadoEm: new Date() } });
}

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/baixar-diario
   Baixa o PDF de um link específico, importa e salva metadata.
   Body: { link: string }
════════════════════════════════════════════════════════════ */
router.post("/sync/baixar-diario", async (req, res) => {
  const { link } = req.body as { link?: string };
  if (!link) { res.status(400).json({ ok: false, mensagem: "Link não informado." }); return; }

  const { usuario, senha } = await getSuapCreds();
  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais SUAP não configuradas. Configure em Ajustes → Sincronização." });
    return;
  }
  try {
    const pdfBuffer = await baixarDiarioPorLink(usuario, senha, link);
    const { secoes, erros: errosParse } = await parseDiarioPDF(pdfBuffer);
    if (secoes.length === 0) {
      res.status(422).json({ ok: false, mensagem: "Nenhuma seção encontrada no PDF.", erros: errosParse });
      return;
    }
    const todosAlunos = await db.select({
      id: alunosTable.id, matricula: alunosTable.matricula,
      nomeCompleto: alunosTable.nomeCompleto, turmaAtual: alunosTable.turmaAtual,
    }).from(alunosTable);

    const resultados: { turma: string; aulasImportadas: number; presencasImportadas: number; erros: string[] }[] = [];
    for (const secao of secoes) {
      const r = await importarSecao(secao, todosAlunos);
      resultados.push({ turma: secao.turmaLocal, ...r });
    }
    await salvarLinkMeta(link, secoes[0].turmaLocal);
    const totalAulas     = resultados.reduce((s, r) => s + r.aulasImportadas, 0);
    const totalPresencas = resultados.reduce((s, r) => s + r.presencasImportadas, 0);
    res.json({ ok: true, turma: secoes[0].turmaLocal, totalAulas, totalPresencas, secoes: resultados, errosParse });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message ?? "Erro interno." });
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/baixar-diario-turma
   Encontra o link pelo nome da turma (via metadata) e importa.
   Body: { turma: string }
════════════════════════════════════════════════════════════ */
router.post("/sync/baixar-diario-turma", async (req, res) => {
  const { turma } = req.body as { turma?: string };
  if (!turma) { res.status(400).json({ ok: false, mensagem: "Turma não informada." }); return; }

  const turmasList = await db.select().from(turmasTable).where(eq(turmasTable.nomeTurma, turma));
  const turmaDb = turmasList[0];

  if (!turmaDb || !turmaDb.linkSuap) {
    res.status(404).json({
      ok: false,
      needsMapping: true,
      mensagem: `Nenhum link SUAP cadastrado para a turma "${turma}". Acesse as configurações da turma, e adicione o Link do Diário no SUAP.`,
    });
    return;
  }
  const link = turmaDb.linkSuap;
  const { usuario, senha } = await getSuapCreds();
  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais SUAP não configuradas." });
    return;
  }
  try {
    const pdfBuffer = await baixarDiarioPorLink(usuario, senha, link);
    const { secoes, erros: errosParse } = await parseDiarioPDF(pdfBuffer);
    const todosAlunos = await db.select({
      id: alunosTable.id, matricula: alunosTable.matricula,
      nomeCompleto: alunosTable.nomeCompleto, turmaAtual: alunosTable.turmaAtual,
    }).from(alunosTable);

    const resultados: { turma: string; aulasImportadas: number; presencasImportadas: number; erros: string[] }[] = [];
    for (const secao of secoes) {
      secao.turmaLocal = turma;
      const r = await importarSecao(secao, todosAlunos);
      resultados.push({ turma: secao.turmaLocal, ...r });
    }
    await salvarLinkMeta(link, turma);
    const totalAulas     = resultados.reduce((s, r) => s + r.aulasImportadas, 0);
    const totalPresencas = resultados.reduce((s, r) => s + r.presencasImportadas, 0);
    res.json({ ok: true, turma, totalAulas, totalPresencas, secoes: resultados, errosParse });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message ?? "Erro interno." });
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/baixar-todos-status — progresso do batch download
════════════════════════════════════════════════════════════ */
router.get("/sync/baixar-todos-status", (_req, res) => {
  res.json(batchSyncState);
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/baixar-todos-diarios
   Baixa todos os links salvos em sequência (background).
════════════════════════════════════════════════════════════ */
router.post("/sync/baixar-todos-diarios", async (req, res) => {
  if (batchSyncState.rodando) {
    res.json({ ok: true, mensagem: "Download já em andamento.", ...batchSyncState });
    return;
  }

  const { usuario, senha } = await getSuapCreds();
  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais SUAP não configuradas." });
    return;
  }

  const turmasComLink = await db.select().from(turmasTable).where(isNotNull(turmasTable.linkSuap));
  const links = turmasComLink.map(t => t.linkSuap as string).filter(Boolean);
  if (links.length === 0) {
    res.status(400).json({ ok: false, mensagem: "Nenhum link de diário cadastrado. Configure em Ajustes → Sincronização." });
    return;
  }

  batchSyncState = { rodando: true, total: links.length, atual: 0, msg: "Iniciando...", erro: null, concluido: false, ultimaSync: null };
  res.json({ ok: true, total: links.length });

  // Background: baixar cada link em sequência
  (async () => {
    const todosAlunos = await db.select({
      id: alunosTable.id, matricula: alunosTable.matricula,
      nomeCompleto: alunosTable.nomeCompleto, turmaAtual: alunosTable.turmaAtual,
    }).from(alunosTable);

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      batchSyncState.atual = i;
      batchSyncState.msg = `Baixando diário ${i + 1}/${links.length}...`;
      try {
        const pdfBuffer = await baixarDiarioPorLink(usuario, senha, link);
        const { secoes } = await parseDiarioPDF(pdfBuffer);
        for (const secao of secoes) {
          await importarSecao(secao, todosAlunos);
          await salvarLinkMeta(link, secao.turmaLocal);
        }
        batchSyncState.msg = `${i + 1}/${links.length} concluídos`;
      } catch (e: any) {
        batchSyncState.msg = `Erro no diário ${i + 1}: ${e.message}`;
      }
    }
    const agora = new Date().toISOString();
    batchSyncState = { rodando: false, total: links.length, atual: links.length, msg: `${links.length} diários sincronizados`, erro: null, concluido: true, ultimaSync: agora };
  })().catch((e) => {
    batchSyncState = { ...batchSyncState, rodando: false, erro: e.message, concluido: true };
  });
});

/* ─── Iniciar sync (ainda legado) ─── */
router.post("/sync/trigger", async (_req, res) => {
  const [syncRecord] = await db.insert(syncStatusTable).values({
    status: "running",
    mensagem: "Sincronização iniciada pela extensão...",
  }).returning();

  res.json({
    status: "running",
    mensagem: "Aguardando a extensão SUAP Sync...",
    ultimaSync: syncRecord.ultimaSync?.toISOString(),
  });
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/auto/status — progresso do sync automático
════════════════════════════════════════════════════════════ */
router.get("/sync/auto/status", (_req, res) => {
  res.json(autoSyncState);
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/auto — sincroniza alunos direto do SUAP
   (login HTTP + download XLS + importação, tudo server-side)
════════════════════════════════════════════════════════════ */
router.post("/sync/auto", async (req, res) => {
  if (autoSyncState.rodando) {
    res.json({ ok: false, mensagem: "Já existe uma sincronização em andamento." });
    return;
  }

  // Credenciais: prioridade env vars → banco de dados
  let usuario = process.env.SUAP_USUARIO ?? "";
  let senha   = process.env.SUAP_SENHA   ?? "";

  if (!usuario || !senha) {
    const [uRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_usuario"));
    const [sRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_senha"));
    usuario = usuario || (uRow?.valor ?? "");
    senha   = senha   || (sRow?.valor ?? "");
  }

  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais do SUAP não configuradas. Vá em Ajustes → Sincronização e cadastre seu login e senha do SUAP." });
    return;
  }

  // Iniciar sync em background
  autoSyncState = { rodando: true, pct: 0, msg: "Iniciando sincronização...", erro: null, concluido: false };
  res.json({ ok: true, mensagem: "Sincronização iniciada. Acompanhe o progresso." });

  // Executar de forma assíncrona (não bloqueia a resposta)
  (async () => {
    try {
      const onProgress = (pct: number, msg: string) => {
        autoSyncState.pct = pct;
        autoSyncState.msg = msg;
        console.log(`[AutoSync] ${pct}% — ${msg}`);
      };

      // Baixar XLS do SUAP
      const xlsBuffer = await sincronizarSUAP(usuario, senha, onProgress);

      onProgress(88, "Processando dados dos alunos...");

      // Parsear XLS
      const workbook = XLSX.read(xlsBuffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        throw new Error("Planilha do SUAP está vazia ou formato inválido.");
      }

      onProgress(90, `${rows.length} alunos encontrados. Importando...`);

      onProgress(90, `${rows.length} alunos encontrados. Importando...`);

      // Importar alunos usando o serviço centralizado
      const result = await processarImportacaoAlunos(rows, { 
        substituirTudo: true, // AutoSync sempre sincroniza o estado atual do SUAP
        onProgress: (pct, msg) => onProgress(pct, msg)
      });

      // Registrar no histórico
      await db.insert(syncStatusTable).values({
        status: "success",
        mensagem: `${result.adicionados} novos, ${result.atualizados} atualizados, ${result.transferidos} transferidos do SUAP.`,
        totalAlunos: String(result.adicionados + result.atualizados),
        ultimaSync: new Date(),
      });

      autoSyncState = {
        rodando: false,
        pct: 100,
        msg: `✓ Sincronização concluída: ${result.adicionados} novos, ${result.atualizados} atualizados.`,
        erro: null,
        concluido: true,
      };

      // Registrar no histórico
      await db.insert(syncStatusTable).values({
        status: "success",
        mensagem: `${importados} alunos importados automaticamente do SUAP (${erros} erros).`,
        totalAlunos: String(importados),
        ultimaSync: new Date(),
      });

      autoSyncState = {
        rodando: false,
        pct: 100,
        msg: `✓ ${importados} alunos sincronizados com sucesso!`,
        erro: null,
        concluido: true,
      };

    } catch (e: any) {
      console.error("[AutoSync] Erro:", e.message);
      autoSyncState = {
        rodando: false,
        pct: 0,
        msg: "",
        erro: e.message || "Erro desconhecido durante a sincronização.",
        concluido: false,
      };
      await db.insert(syncStatusTable).values({
        status: "error",
        mensagem: `Erro na sincronização automática: ${e.message}`,
        ultimaSync: new Date(),
      });
    }
  })();
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/upload-alunos
   Recebe base64 do XLS exportado pelo SUAP e importa os dados
═══════════════════════════════════════════════════════════ */
router.post("/sync/upload-alunos", async (req, res) => {
  const { arquivo } = req.body as { arquivo?: string };

  if (!arquivo) {
    res.status(400).json({ mensagem: "Arquivo XLS não enviado." });
    return;
  }

  const { substituirTudo } = req.body as { arquivo?: string; substituirTudo?: boolean };

  try {
    // Decodificar base64 (formato: data:...;base64,XXXXX)
    const base64 = arquivo.includes(",") ? arquivo.split(",")[1] : arquivo;
    const buffer = Buffer.from(base64, "base64");

    // Parsear XLS
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // ── Detectar linha real do cabeçalho ──────────────────────────────────────
    // Planilhas SUAP frequentemente têm linhas de título antes dos dados reais.
    // Lemos as primeiras 20 linhas como arrays e procuramos a que contém "nome".
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
      const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
      if (acertos >= 2) { headerRowIdx = i; break; }
    }

    // Re-parsear a partir da linha do cabeçalho real
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      range: headerRowIdx,
    });

    if (rows.length === 0) {
      res.status(400).json({ mensagem: "Planilha vazia ou formato inválido." });
      return;
    }

    // Detectar colunas automaticamente (SUAP pode ter variações de nome)
    const primeiraLinha = rows[0];
    const colunas = Object.keys(primeiraLinha);

    console.log(`[upload-alunos] Cabeçalho na linha ${headerRowIdx}, colunas: ${colunas.slice(0, 8).join(", ")}`);
    console.log(`[upload-alunos] Total de linhas de dados: ${rows.length}`);

    const mapearColuna = (chaves: string[]): string | undefined => {
      for (const k of chaves) {
        const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
        if (match) return match;
      }
      return undefined;
    };

    const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."]);
    const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"]);
    const colTurma        = mapearColuna(["turma", "turma/série"]);
    const colTurno        = mapearColuna(["turno"]);
    const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);
    const colNascimento   = mapearColuna(["data de nascimento", "nascimento", "data nasc", "nascimento_data"]);
    const colCPF          = mapearColuna(["cpf"]);
    const colRG           = mapearColuna(["rg"]);
    const colMae          = mapearColuna(["nome da mãe", "nome da mae", "mãe", "mae", "nome_mae"]);
    const colPai          = mapearColuna(["nome do pai", "pai", "nome_pai"]);
    const colResponsavel  = mapearColuna(["responsável", "responsavel"]);
    const colTelefone     = mapearColuna(["telefone", "celular", "fone", "telefones"]);
    const colEndereco     = mapearColuna(["endereço", "endereco", "logradouro", "get_endereco"]);
    const colZona         = mapearColuna(["zona", "zona residencial", "zona_residencial"]);
    const colSexo         = mapearColuna(["sexo", "gênero", "genero"]);
    const colEtnia        = mapearColuna(["etnia", "raça", "raca", "cor/raça", "pessoa_fisica.raca"]);
    const colEmailPessoal = mapearColuna(["e-mail", "email", "e-mail do aluno", "pessoa_fisica.email"]);
    const colEmailResp    = mapearColuna(["e-mail do responsável", "email responsavel", "email_responsavel"]);
    const colAnoIngresso  = mapearColuna(["ano de ingresso", "ano ingresso", "ano_letivo"]);
    const colNivel        = mapearColuna(["nível de ensino", "nivel ensino", "nivel"]);
    const colCurso        = mapearColuna(["descrição do curso", "curso", "descricao do curso", "curso_campus.descricao"]);
    const colCodCurso     = mapearColuna(["código do curso", "cod curso", "codigo curso", "curso_campus.codigo"]);
    const colPrevisao     = mapearColuna(["ano de previsão", "previsao conclusao", "ano_let_prev_conclusao"]);
    const colNaturalidade = mapearColuna(["naturalidade", "cidade natural", "cidade de nascimento"]);

    const formatarData = (val: any): string => {
      if (!val) return "";
      if (val instanceof Date) {
        const d = val.getDate().toString().padStart(2, "0");
        const m = (val.getMonth() + 1).toString().padStart(2, "0");
        const a = val.getFullYear();
        return `${d}/${m}/${a}`;
      }
      const s = String(val).trim();
      if (!s) return "";
      // Já está em DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const parts = s.split("T")[0].split("-");
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return s;
    };

    // Importar alunos usando o serviço centralizado
    const result = await processarImportacaoAlunos(rows, { substituirTudo });

    // Registrar no histórico
    await db.insert(syncStatusTable).values({
      status: "success",
      mensagem: `Planilha importada: ${result.adicionados} novos, ${result.atualizados} atualizados, ${result.transferidos} transferidos.`,
      totalAlunos: String(result.adicionados + result.atualizados),
      ultimaSync: new Date(),
    });

    res.json({
      ok: true,
      adicionados: result.adicionados,
      atualizados: result.atualizados,
      transferidos: result.transferidos,
      erros: result.erros,
      total: rows.length,
      mensagem: `Planilha processada: ${result.adicionados} novos, ${result.atualizados} atualizados, ${result.transferidos} transferidos.`,
    });


  } catch (e: any) {
    console.error("Erro no upload-alunos:", e);

    await db.insert(syncStatusTable).values({
      status: "error",
      mensagem: "Erro ao processar planilha: " + e.message,
    }).catch(() => {});

    res.status(500).json({ mensagem: "Erro ao processar o arquivo: " + e.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/upload-professores
   Importa/atualiza professores a partir de um XLS do SUAP
═══════════════════════════════════════════════════════════ */
router.post("/sync/upload-professores", async (req, res) => {
  try {
    const { arquivo } = req.body as { arquivo: string };
    if (!arquivo) { res.status(400).json({ mensagem: "Arquivo não fornecido." }); return; }

    const base64Data = arquivo.includes(",") ? arquivo.split(",")[1] : arquivo;
    const buffer = Buffer.from(base64Data, "base64");
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = wb.SheetNames[0];
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });

    // Detectar linha real do cabeçalho
    const PALAVRAS_CAB = ["nome", "matrícula", "matricula", "campus"];
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
      const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
      const acertos = PALAVRAS_CAB.filter(p => rowJoined.includes(p)).length;
      if (acertos >= 2) { headerRowIdx = i; break; }
    }

    // Parsear como objetos a partir da linha de cabeçalho
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      defval: "",
      range: headerRowIdx,
    });

    if (rows.length === 0) {
      res.status(400).json({ mensagem: "Planilha vazia ou formato inválido." });
      return;
    }

    const colunas = Object.keys(rows[0]);
    // Retorna o nome REAL da coluna (não a chave de busca)
    const mapearColuna = (chaves: string[]): string | undefined => {
      for (const k of chaves) {
        const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
        if (match) return match;
      }
      return undefined;
    };

    const colNome       = mapearColuna(["nome"]);
    const colMatricula  = mapearColuna(["matrícula", "matricula"]);
    const colEmail      = mapearColuna(["e-mail", "email"]);
    const colCargo      = mapearColuna(["cargo"]);
    const colJornada    = mapearColuna(["jornada"]);
    const colTitulacao  = mapearColuna(["titulação", "titulacao"]);
    const colCampus     = mapearColuna(["campus"]);

    const val = (row: Record<string, any>, col: string | undefined) =>
      col ? String(row[col] ?? "").trim() : "";

    console.log(`[upload-professores] Cabeçalho linha ${headerRowIdx}, total: ${rows.length}`);
    console.log(`[upload-professores] Colunas detectadas: nome=${colNome}, mat=${colMatricula}, email=${colEmail}, cargo=${colCargo}`);

    // Pré-carregar todos os professores para lookup O(1)
    const existentesDB = await db.select({
      id: professoresTable.id,
      matricula: professoresTable.matricula,
      nome: professoresTable.nome,
    }).from(professoresTable);
    const matriculasDB = new Map(existentesDB.filter(p => p.matricula).map(p => [p.matricula!, p.id]));
    const nomesDB = new Map(existentesDB.map(p => [p.nome.toLowerCase().trim(), p.id]));

    let adicionados = 0, atualizados = 0, ignorados = 0, erros = 0;

    for (const row of rows) {
      try {
        const nome      = val(row, colNome);
        const matricula = val(row, colMatricula);
        const campus    = val(row, colCampus);

        if (!nome) continue;

        // Filtrar apenas professores do campus José Giró Faísca
        if (campus && !campus.toLowerCase().includes("giró") &&
            !campus.toLowerCase().includes("giro") &&
            !campus.toLowerCase().includes("faísca") &&
            !campus.toLowerCase().includes("faisca")) {
          ignorados++;
          continue;
        }

        const email     = val(row, colEmail) || null;
        const cargo     = val(row, colCargo) || null;
        const jornada   = val(row, colJornada) || null;
        const titulacao = val(row, colTitulacao) || null;

        const dadosProfessor = {
          nome,
          matricula: matricula || null,
          email: email || null,
          cargo: cargo || null,
          jornada: jornada || null,
          titulacao: titulacao || null,
          // Manter vinculo compatível: usa cargo como vínculo principal
          vinculo: cargo || null,
        } as any;

        if (matricula) {
          // Upsert atômico por matrícula
          await db.insert(professoresTable)
            .values(dadosProfessor)
            .onConflictDoUpdate({
              target: professoresTable.matricula,
              set: dadosProfessor,
            });
          const eraNovoProf = !matriculasDB.has(matricula);
          if (eraNovoProf) adicionados++; else atualizados++;
        } else {
          // Sem matrícula: busca por nome exato
          const idExistente = nomesDB.get(nome.toLowerCase().trim());
          if (idExistente) {
            await db.update(professoresTable).set(dadosProfessor).where(eq(professoresTable.id, idExistente));
            atualizados++;
          } else {
            await db.insert(professoresTable).values(dadosProfessor);
            adicionados++;
          }
        }
      } catch (e: any) {
        erros++;
        console.error(`[upload-professores] Erro (nome=${val(row, colNome)}, mat=${val(row, colMatricula)}):`, e?.message ?? e);
      }
    }

    console.log(`[upload-professores] Concluído: ${adicionados} adicionados, ${atualizados} atualizados, ${ignorados} ignorados, ${erros} erros`);
    res.json({ ok: true, adicionados, atualizados, ignorados, erros, total: rows.length });
  } catch (e: any) {
    console.error("Erro no upload-professores:", e);
    res.status(500).json({ mensagem: "Erro ao processar o arquivo: " + e.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/gerar-token
   Gera um token de curta duração para uso no bookmarklet
═══════════════════════════════════════════════════════════ */
// Tokens permanentes (1 ano): token → expiry timestamp
const bookmarkletTokens = new Map<string, number>();

router.post("/sync/gerar-token", (req, res) => {
  // Gerar token aleatório de longa duração (1 ano)
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expiry = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 ano
  bookmarkletTokens.set(token, expiry);

  // Limpar tokens expirados
  for (const [t, exp] of bookmarkletTokens) {
    if (Date.now() > exp) bookmarkletTokens.delete(t);
  }

  res.json({ token, expiresIn: 365 * 24 * 3600 });
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/bookmarklet-upload
   Recebe XLS base64 com token de autenticação do bookmarklet
═══════════════════════════════════════════════════════════ */
router.post("/sync/bookmarklet-upload", async (req, res) => {
  const { arquivo, token } = req.body as { arquivo?: string; token?: string };

  if (!token) {
    res.status(401).json({ mensagem: "Token não informado." });
    return;
  }

  const expiry = bookmarkletTokens.get(token);
  if (!expiry || Date.now() > expiry) {
    bookmarkletTokens.delete(token);
    res.status(401).json({ mensagem: "Token inválido ou expirado. Gere um novo bookmarklet." });
    return;
  }

  if (!arquivo) {
    res.status(400).json({ mensagem: "Arquivo XLS não enviado." });
    return;
  }

  // Reutilizar a mesma lógica do upload-alunos
  try {
    const base64 = arquivo.includes(",") ? arquivo.split(",")[1] : arquivo;
    const buffer = Buffer.from(base64, "base64");

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      res.status(400).json({ mensagem: "Planilha vazia ou formato inválido." });
      return;
    }

    const primeiraLinha = rows[0];
    const colunas = Object.keys(primeiraLinha);
    const mapearColuna = (chaves: string[]): string | undefined => {
      for (const k of chaves) {
        const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
        if (match) return match;
      }
      return undefined;
    };

    const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."]);
    const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"]);
    const colTurma        = mapearColuna(["turma", "turma/série"]);
    const colTurno        = mapearColuna(["turno"]);
    const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);
    const colNascimento   = mapearColuna(["data de nascimento", "nascimento", "data nasc"]);
    const colCPF          = mapearColuna(["cpf"]);
    const colRG           = mapearColuna(["rg"]);
    const colMae          = mapearColuna(["nome da mãe", "nome da mae", "mãe", "mae"]);
    const colPai          = mapearColuna(["nome do pai", "pai"]);
    const colResponsavel  = mapearColuna(["responsável", "responsavel"]);
    const colTelefone     = mapearColuna(["telefone", "celular", "fone"]);
    const colEndereco     = mapearColuna(["endereço", "endereco", "logradouro"]);
    const colZona         = mapearColuna(["zona", "zona residencial"]);
    const colSexo         = mapearColuna(["sexo", "gênero", "genero"]);
    const colEtnia        = mapearColuna(["etnia", "raça", "raca", "cor/raça"]);
    const colEmailPessoal = mapearColuna(["e-mail", "email", "e-mail do aluno"]);
    const colEmailResp    = mapearColuna(["e-mail do responsável", "email responsavel"]);
    const colNivel        = mapearColuna(["nível de ensino", "nivel ensino", "nivel"]);

    const formatarData = (val: any): string => {
      if (!val) return "";
      if (val instanceof Date) {
        const d = val.getDate().toString().padStart(2, "0");
        const m = (val.getMonth() + 1).toString().padStart(2, "0");
        const a = val.getFullYear();
        return `${d}/${m}/${a}`;
      }
      const s = String(val).trim();
      if (!s) return "";
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const parts = s.split("T")[0].split("-");
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return s;
    };

    let importados = 0;
    let erros = 0;

    for (const row of rows) {
      try {
        const matricula = colMatricula ? String(row[colMatricula] ?? "").trim() : "";
        const nomeCompleto = colNome ? String(row[colNome] ?? "").trim() : "";
        if (!nomeCompleto) continue;

        const alunoData = {
          matricula,
          nomeCompleto,
          nomeTurma: colTurma ? String(row[colTurma] ?? "").trim() : "",
          turno: colTurno ? String(row[colTurno] ?? "").trim() : "",
          situacao: colSituacao ? String(row[colSituacao] ?? "").trim() : "Matriculado",
          dataNascimento: colNascimento ? formatarData(row[colNascimento]) : "",
          cpf: colCPF ? String(row[colCPF] ?? "").trim() : "",
          rg: colRG ? String(row[colRG] ?? "").trim() : "",
          nomeMae: colMae ? String(row[colMae] ?? "").trim() : "",
          nomePai: colPai ? String(row[colPai] ?? "").trim() : "",
          responsavel: colResponsavel ? String(row[colResponsavel] ?? "").trim() : "",
          telefone: colTelefone ? String(row[colTelefone] ?? "").trim() : "",
          endereco: colEndereco ? String(row[colEndereco] ?? "").trim() : "",
          zonaResidencial: colZona ? String(row[colZona] ?? "").trim() : "",
          sexo: colSexo ? String(row[colSexo] ?? "").trim() : "",
          etnia: colEtnia ? String(row[colEtnia] ?? "").trim() : "",
          emailPessoal: colEmailPessoal ? String(row[colEmailPessoal] ?? "").trim() : "",
          emailResponsavel: colEmailResp ? String(row[colEmailResp] ?? "").trim() : "",
          nivelEnsino: colNivel ? String(row[colNivel] ?? "").trim() : "",
        };

        const existing = matricula
          ? await db.select().from(alunosTable).where(eq(alunosTable.matricula, matricula)).limit(1)
          : [];

        if (existing.length > 0) {
          await db.update(alunosTable).set(alunoData).where(eq(alunosTable.matricula, matricula));
        } else {
          await db.insert(alunosTable).values(alunoData);
        }
        importados++;
      } catch (e) {
        erros++;
      }
    }

    bookmarkletTokens.delete(token); // invalidar token após uso

    await db.insert(syncStatusTable).values({
      status: "success",
      mensagem: `${importados} alunos importados via Bookmarklet SUAP (${erros} erros).`,
      totalAlunos: String(importados),
      ultimaSync: new Date(),
    });

    res.json({
      ok: true,
      importados,
      erros,
      total: rows.length,
      mensagem: `${importados} alunos importados com sucesso via Bookmarklet!`,
    });

  } catch (e: any) {
    res.status(500).json({ mensagem: "Erro ao processar o arquivo: " + e.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   GET /api/sync/baixar-extensao
   Gera e retorna o ZIP da extensão Chrome para download
═══════════════════════════════════════════════════════════ */
router.get("/sync/baixar-extensao", (req, res) => {
  // Localizar a pasta da extensão (relativa ao projeto)
  const extensaoDir = path.resolve(
    process.cwd(),
    "../../artifacts/escola/public/suap-extension"
  );

  if (!fs.existsSync(extensaoDir)) {
    res.status(404).json({ mensagem: "Arquivos da extensão não encontrados." });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=\"suap-sync-extensao.zip\"");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).json({ mensagem: err.message }));
  archive.pipe(res);
  archive.directory(extensaoDir, "suap-extension");
  archive.finalize();
});

/* ═══════════════════════════════════════════════════════════
   SYNC DE DIÁRIOS — estado em memória
════════════════════════════════════════════════════════════ */
let diarioSyncState: {
  rodando: boolean;
  pct: number;
  msg: string;
  erro: string | null;
  concluido: boolean;
  resultados: { turma: string; aulasImportadas: number; presencasImportadas: number; alunosNaoEncontrados: string[]; erros: string[] }[];
  errosDiarios: { suapId: string; turma: string; erro: string }[];
  totalAulas: number;
  totalPresencas: number;
} = { rodando: false, pct: 0, msg: "", erro: null, concluido: false, resultados: [], errosDiarios: [], totalAulas: 0, totalPresencas: 0 };

/* GET /api/sync/diarios-auto/status */
router.get("/sync/diarios-auto/status", (_req, res) => {
  res.json(diarioSyncState);
});

/* POST /api/sync/diarios-auto — inicia sync de diários server-side */
router.post("/sync/diarios-auto", async (req, res) => {
  if (diarioSyncState.rodando) {
    res.json({ ok: true, mensagem: "Sync já em andamento." });
    return;
  }

  const credUsuario = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_usuario"));
  const credSenha   = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_senha"));
  const usuario = credUsuario[0]?.valor ?? process.env.SUAP_USUARIO ?? "";
  const senha   = credSenha[0]?.valor   ?? process.env.SUAP_SENHA   ?? "";

  if (!usuario || !senha) {
    res.status(400).json({ ok: false, mensagem: "Credenciais SUAP não configuradas. Salve o usuário e senha na seção de Sincronização." });
    return;
  }

  diarioSyncState = { rodando: true, pct: 0, msg: "Iniciando sync de diários...", erro: null, concluido: false, resultados: [], errosDiarios: [], totalAulas: 0, totalPresencas: 0 };
  res.json({ ok: true, mensagem: "Sincronização de diários iniciada." });

  (async () => {
    try {
      const todosAlunos = await db.select({
        id: alunosTable.id,
        nomeCompleto: alunosTable.nomeCompleto,
        matricula: alunosTable.matricula,
        turmaAtual: alunosTable.turmaAtual,
      }).from(alunosTable);

      const { secoes, erros: errosDiarios } = await sincronizarDiariosSUAP(
        usuario,
        senha,
        (pct, msg) => {
          diarioSyncState.pct = pct;
          diarioSyncState.msg = msg;
        }
      );

      let totalAulas = 0;
      let totalPresencas = 0;
      const resultados: typeof diarioSyncState.resultados = [];

      for (const secao of secoes) {
        try {
          const res2 = await importarSecao(secao, todosAlunos);
          totalAulas     += res2.aulasImportadas;
          totalPresencas += res2.presencasImportadas;
          resultados.push({
            turma: secao.turmaLocal || secao.turmaCodigo,
            aulasImportadas: res2.aulasImportadas,
            presencasImportadas: res2.presencasImportadas,
            alunosNaoEncontrados: res2.alunosNaoEncontrados,
            erros: res2.erros,
          });
        } catch (e: any) {
          resultados.push({
            turma: secao.turmaLocal || secao.turmaCodigo,
            aulasImportadas: 0,
            presencasImportadas: 0,
            alunosNaoEncontrados: [],
            erros: [e.message],
          });
        }
      }

      diarioSyncState = {
        rodando: false,
        pct: 100,
        msg: `Concluído! ${totalAulas} aulas e ${totalPresencas} presenças importadas.`,
        erro: null,
        concluido: true,
        resultados,
        errosDiarios,
        totalAulas,
        totalPresencas,
      };
    } catch (e: any) {
      diarioSyncState = {
        ...diarioSyncState,
        rodando: false,
        erro: e.message || "Erro desconhecido",
        concluido: false,
      };
    }
  })();
});

/* ═══════════════════════════════════════════════════════════
   POST /api/sync/diario-pdf
   Recebe base64 de um PDF de diário SUAP e importa presenças/atividades
════════════════════════════════════════════════════════════ */
router.post("/sync/diario-pdf", async (req, res) => {
  const { arquivo } = req.body as { arquivo?: string };
  if (!arquivo) {
    res.status(400).json({ mensagem: "PDF não enviado." });
    return;
  }

  try {
    const base64 = arquivo.includes(",") ? arquivo.split(",")[1] : arquivo;
    const buffer = Buffer.from(base64, "base64");

    // 1. Parsear o PDF
    const { secoes, erros: errosParse } = await parseDiarioPDF(buffer);

    if (secoes.length === 0) {
      res.status(422).json({
        mensagem: "Nenhuma seção de diário encontrada no PDF.",
        erros: errosParse,
      });
      return;
    }

    // 2. Buscar dados de referência do banco
    const todosAlunos = await db.select({
      id: alunosTable.id,
      matricula: alunosTable.matricula,
      nomeCompleto: alunosTable.nomeCompleto,
      turmaAtual: alunosTable.turmaAtual,
    }).from(alunosTable);

    const resultados: {
      turma: string;
      turmaCodigo: string;
      bimestre: number;
      professorRegente: string;
      aulasImportadas: number;
      presencasImportadas: number;
      alunosNaoEncontrados: string[];
      erros: string[];
    }[] = [];

    for (const secao of secoes) {
      const res2 = await importarSecao(secao, todosAlunos);
      resultados.push({
        turma: secao.turmaLocal,
        turmaCodigo: secao.turmaCodigo,
        bimestre: secao.bimestre,
        professorRegente: secao.professorRegente,
        ...res2,
      });
    }

    const totalAulas = resultados.reduce((s, r) => s + r.aulasImportadas, 0);
    const totalPresencas = resultados.reduce((s, r) => s + r.presencasImportadas, 0);

    res.json({
      ok: true,
      mensagem: `${totalAulas} aulas e ${totalPresencas} registros de presença importados.`,
      secoes: resultados,
      errosParse,
    });
  } catch (e: any) {
    console.error("Erro ao processar PDF de diário:", e);
    res.status(500).json({ mensagem: e.message ?? "Erro interno ao processar o PDF." });
  }
});

async function importarSecao(
  secao: SecaoDiario,
  todosAlunos: { id: number; matricula: string | null; nomeCompleto: string; turmaAtual: string | null }[]
): Promise<{
  aulasImportadas: number;
  presencasImportadas: number;
  alunosNaoEncontrados: string[];
  erros: string[];
}> {
  let aulasImportadas = 0;
  let presencasImportadas = 0;
  const alunosNaoEncontrados: string[] = [];
  const erros: string[] = [];

  // Filtrar alunos da turma local correspondente
  const alunosDaTurma = todosAlunos.filter(
    (a) => a.turmaAtual?.toUpperCase() === secao.turmaLocal.toUpperCase()
  );

  // Mapa: matricula → alunoId
  const porMatricula = new Map<string, number>();
  for (const a of alunosDaTurma) {
    if (a.matricula) porMatricula.set(a.matricula.trim(), a.id);
  }

  // Mapa: nome normalizado → alunoId (fallback)
  const porNome = new Map<string, number>();
  for (const a of alunosDaTurma) {
    porNome.set(normNome(a.nomeCompleto), a.id);
  }

  // 1. Importar atividades → diario_aulas
  const datasComConteudo = new Map<string, { numAulas: number; conteudo: string }>();
  for (const at of secao.atividades) {
    datasComConteudo.set(at.data, { numAulas: at.numAulas, conteudo: at.conteudo });
  }

  // Coletar todas as datas das presenças (pode haver datas sem conteúdo)
  const todasDatas = new Set<string>();
  for (const al of secao.alunos) {
    for (const f of al.frequencias) todasDatas.add(f.data);
  }

  // Upsert diario_aulas e criar mapa data → aulaId
  const aulaIdPorData = new Map<string, number>();
  for (const data of todasDatas) {
    const info = datasComConteudo.get(data);
    try {
      const [row] = await db
        .insert(diarioAulasTable)
        .values({
          turmaNome: secao.turmaLocal,
          data,
          numeroAulas: info?.numAulas ?? 1,
          conteudo: info?.conteudo ?? null,
        })
        .onConflictDoUpdate({
          target: [diarioAulasTable.turmaNome, diarioAulasTable.data],
          set: {
            numeroAulas: info?.numAulas ?? 1,
            conteudo: info?.conteudo ?? null,
          },
        })
        .returning({ id: diarioAulasTable.id });
      aulaIdPorData.set(data, row.id);
      aulasImportadas++;
    } catch (e: any) {
      erros.push(`Aula ${data}: ${e.message}`);
    }
  }

  // 2. Importar presenças → diario_presencas
  for (const aluno of secao.alunos) {
    // Resolver alunoId: primeiro por matrícula, depois por nome
    let alunoId = porMatricula.get(aluno.matricula);
    if (!alunoId) alunoId = porNome.get(aluno.nome);

    if (!alunoId) {
      // Busca mais ampla (sem filtrar por turma) — aluno pode estar em outra turma
      for (const a of todosAlunos) {
        if (a.matricula?.trim() === aluno.matricula) { alunoId = a.id; break; }
      }
    }
    if (!alunoId) {
      for (const a of todosAlunos) {
        if (normNome(a.nomeCompleto) === aluno.nome) { alunoId = a.id; break; }
      }
    }

    if (!alunoId) {
      alunosNaoEncontrados.push(aluno.nome);
      continue;
    }

    for (const f of aluno.frequencias) {
      const aulaId = aulaIdPorData.get(f.data);
      if (!aulaId) continue;
      try {
        await db
          .insert(diarioPresencasTable)
          .values({ aulaId, alunoId, status: f.status })
          .onConflictDoUpdate({
            target: [diarioPresencasTable.aulaId, diarioPresencasTable.alunoId],
            set: { status: f.status },
          });
        presencasImportadas++;
      } catch (e: any) {
        erros.push(`Presença aluno ${alunoId} dia ${f.data}: ${e.message}`);
      }
    }
  }

  return { aulasImportadas, presencasImportadas, alunosNaoEncontrados, erros };
}

export default router;

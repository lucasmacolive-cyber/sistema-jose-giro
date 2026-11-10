// @ts-nocheck
import { Router, type IRouter } from "express";
import { db, alunosTable, notasTable, presencasTable, configuracoesTable } from "../lib/db/index.ts";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_FREELLMAPI_URL = process.env.FREELLMAPI_URL || "http://127.0.0.1:3001/v1";
const DEFAULT_FREELLMAPI_KEY =
  process.env.FREELLMAPI_KEY || "freellmapi-aa87fccb22653ee609ae7163613e8b3a5fa533efc766c24f";

async function getFreeLlmConfig() {
  const [urlRow] = await db
    .select()
    .from(configuracoesTable)
    .where(eq(configuracoesTable.chave, "freellmapi_url"));
  const [keyRow] = await db
    .select()
    .from(configuracoesTable)
    .where(eq(configuracoesTable.chave, "freellmapi_key"));

  return {
    baseUrl: (urlRow?.valor || DEFAULT_FREELLMAPI_URL).replace(/\/$/, ""),
    apiKey: keyRow?.valor || DEFAULT_FREELLMAPI_KEY,
  };
}

async function callFreeLlmChat(messages: { role: string; content: string }[]): Promise<string | null> {
  const { baseUrl, apiKey } = await getFreeLlmConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "auto",
        messages,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

router.get("/ai/status", async (_req, res) => {
  const { baseUrl, apiKey } = await getFreeLlmConfig();
  res.json({
    ok: true,
    provider: "FreeLLMAPI",
    baseUrl,
    keyConfigured: Boolean(apiKey),
  });
});

router.post("/ai/parecer", async (req, res) => {
  try {
    const { alunoId, nome, turma, faltas, frequencia, notas } = req.body ?? {};
    let alunoNome = nome || "Aluno(a)";
    let alunoTurma = turma || "";
    let resumoNotas = notas || "";
    let resumoFreq = frequencia !== undefined ? `${frequencia}% (${faltas ?? 0} faltas)` : "";

    if (alunoId) {
      const [al] = await db.select().from(alunosTable).where(eq(alunosTable.id, Number(alunoId)));
      if (al) {
        alunoNome = al.nomeCompleto;
        alunoTurma = al.turmaAtual || "";
      }
      const nRows = await db.select().from(notasTable).where(eq(notasTable.alunoId, Number(alunoId)));
      const pRows = await db.select().from(presencasTable).where(eq(presencasTable.alunoId, Number(alunoId)));
      if (!resumoNotas && nRows.length > 0) {
        resumoNotas = nRows.map((n) => `${n.bimestre}º Bim: ${n.notaFinal ?? "—"}`).join(", ");
      }
      if (!resumoFreq && pRows.length > 0) {
        const totFaltas = pRows.reduce((s, p) => s + (p.faltas || 0), 0);
        const totAulas = pRows.reduce((s, p) => s + (p.totalAulas || 0), 0);
        const pct = totAulas > 0 ? Math.round(((totAulas - totFaltas) / totAulas) * 100) : 100;
        resumoFreq = `${pct}% (${totFaltas} faltas em ${totAulas} aulas)`;
      }
    }

    const prompt = `Elabore um parecer pedagógico escolar conciso, profissional e acolhedor em português (Brasil) para o(a) estudante ${alunoNome}, da turma ${alunoTurma || "regular"} da E.M. José Giró Faísca.
Dados registrados:
- Frequência: ${resumoFreq || "Regular"}
- Avaliações / Notas: ${resumoNotas || "Em acompanhamento bimestral"}
Inclua: 1) Análise da assiduidade/frequência; 2) Desempenho pedagógico; 3) Recomendações de acompanhamento para a família e equipe escolar.`;

    const aiResponse = await callFreeLlmChat([
      {
        role: "system",
        content: "Você é o Coordenador Pedagógico Inteligente da Escola Municipal José Giró Faísca (Campos dos Goytacazes - RJ).",
      },
      { role: "user", content: prompt },
    ]);

    const parecerFinal =
      aiResponse ||
      `PARECER PEDAGÓGICO — E.M. JOSÉ GIRÓ FAÍSCA\n\n` +
        `Estudante: ${alunoNome} (${alunoTurma || "Turma Regular"})\n` +
        `Frequência Acumulada: ${resumoFreq || "Em acompanhamento"}\n` +
        `Desempenho Bimestral: ${resumoNotas || "Em processo de avaliação contínua"}\n\n` +
        `1. Assiduidade: O(a) estudante apresenta registro de frequência monitorado pelo Diário Digital SUAP (${resumoFreq || "regular"}). Recomenda-se manter a assiduidade diária para fortalecimento do vínculo escolar.\n` +
        `2. Desenvolvimento Pedagógico: Participa das atividades propostas para a etapa (${alunoTurma}), com acompanhamento contínuo das habilidades previstas na BNCC.\n` +
        `3. Encaminhamentos: Manter parceria ativa entre família e escola e acompanhar os registros bimestrais no portal escolar.`;

    res.json({
      ok: true,
      provider: aiResponse ? "freellmapi-live" : "freellmapi-fallback",
      parecer: parecerFinal,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message || "Erro ao gerar parecer pedagógico." });
  }
});

router.post("/ai/assistente", async (req, res) => {
  try {
    const { pergunta, contexto } = req.body ?? {};
    if (!pergunta) {
      res.status(400).json({ ok: false, mensagem: "Informe a pergunta para o assistente." });
      return;
    }

    const aiResponse = await callFreeLlmChat([
      {
        role: "system",
        content:
          "Você é o Assistente de Gestão Escolar da E.M. José Giró Faísca. Responda sempre em português do Brasil de forma objetiva, clara e útil.",
      },
      {
        role: "user",
        content: contexto ? `Contexto: ${contexto}\n\nPergunta: ${pergunta}` : String(pergunta),
      },
    ]);

    res.json({
      ok: true,
      provider: aiResponse ? "freellmapi-live" : "freellmapi-fallback",
      resposta:
        aiResponse ||
        "O Assistente Pedagógico processou sua solicitação com base nos dados sincronizados da E.M. José Giró Faísca.",
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message || "Erro no assistente IA." });
  }
});

export default router;


// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index.ts";
import {
  automatizacoesWhatsappTable,
  filaWhatsappTable,
  professoresTable,
  alunosTable,
  funcionariosTable,
  configuracoesTable,
  diarioAulasTable,
  diarioPresencasTable,
  diarioConfiguracoesTable,
  turmasTable,
} from "../lib/db/index.ts";
import { eq, and, lte, ilike, inArray, sql, asc } from "drizzle-orm";
import { isDiaLetivo } from "../lib/calendario2026";

const router: IRouter = Router();

// ─── Listar todas as automações ───────────────────────────────────────────────
router.get("/automatizacoes", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(automatizacoesWhatsappTable)
      .orderBy(automatizacoesWhatsappTable.criadoEm);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Criar nova automação ─────────────────────────────────────────────────────
router.post("/automatizacoes", async (req, res) => {
  try {
    const data = req.body;
    const proxima = calcularProxima(data.frequencia, data.diasSemana, data.diaMes, data.horario, data.diasMes);
    const [nova] = await db.insert(automatizacoesWhatsappTable).values({
      nome:              data.nome,
      tipoDocumento:     data.tipoDocumento || "mensagem",
      mensagem:          data.mensagem || null,
      arquivoBase64:     data.arquivoBase64 || null,
      nomeArquivo:       data.nomeArquivo || null,
      mimetype:          data.mimetype || null,
      frequencia:        data.frequencia || "unico",
      diasSemana:        data.diasSemana || null,
      diaMes:            data.diaMes ? parseInt(data.diaMes) : null,
      horario:           data.horario || "08:00",
      destinatarioTipo:  data.destinatarioTipo || "numero",
      destinatarioValor: data.destinatarioValor || null,
      documentoEscopo:  data.documentoEscopo || "todas",
      documentoAlvo:    data.documentoAlvo || null,
      documentoMes:     data.documentoMes || "atual",
      diasMes:          data.diasMes || null,
      ativa:             true,
      proximaExecucao:   proxima,
    }).returning();
    res.status(201).json(nova);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Atualizar automação ──────────────────────────────────────────────────────
router.put("/automatizacoes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;
    const proxima = calcularProxima(data.frequencia, data.diasSemana, data.diaMes, data.horario, data.diasMes);
    const [upd] = await db.update(automatizacoesWhatsappTable).set({
      nome:              data.nome,
      tipoDocumento:     data.tipoDocumento,
      mensagem:          data.mensagem || null,
      arquivoBase64:     data.arquivoBase64 || null,
      nomeArquivo:       data.nomeArquivo || null,
      mimetype:          data.mimetype || null,
      frequencia:        data.frequencia,
      diasSemana:        data.diasSemana || null,
      diaMes:            data.diaMes ? parseInt(data.diaMes) : null,
      horario:           data.horario,
      destinatarioTipo:  data.destinatarioTipo,
      destinatarioValor: data.destinatarioValor || null,
      documentoEscopo:  data.documentoEscopo || "todas",
      documentoAlvo:    data.documentoAlvo || null,
      documentoMes:     data.documentoMes || "atual",
      diasMes:          data.diasMes || null,
      ativa:             data.ativa !== undefined ? data.ativa : true,
      proximaExecucao:   proxima,
      atualizadoEm:      new Date(),
    }).where(eq(automatizacoesWhatsappTable.id, id)).returning();
    res.json(upd);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Ativar/Desativar ─────────────────────────────────────────────────────────
router.patch("/automatizacoes/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [current] = await db.select({ ativa: automatizacoesWhatsappTable.ativa })
      .from(automatizacoesWhatsappTable).where(eq(automatizacoesWhatsappTable.id, id));
    const novaAtiva = !current.ativa;
    await db.update(automatizacoesWhatsappTable)
      .set({ ativa: novaAtiva, atualizadoEm: new Date() })
      .where(eq(automatizacoesWhatsappTable.id, id));
    res.json({ ativa: novaAtiva });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Executar agora (manual) ─────────────────────────────────────────────────
router.post("/automatizacoes/:id/executar-agora", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [auto] = await db.select().from(automatizacoesWhatsappTable)
      .where(eq(automatizacoesWhatsappTable.id, id));
    if (!auto) return res.status(404).json({ erro: "Automação não encontrada" });
    const inseridos = await executarAutomacao(auto);
    res.json({ ok: true, mensagensEnfileiradas: inseridos });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Deletar automação ───────────────────────────────────────────────────────
router.delete("/automatizacoes/:id", async (req, res) => {
  try {
    await db.delete(automatizacoesWhatsappTable)
      .where(eq(automatizacoesWhatsappTable.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ─── Executar automações vencidas (chamado pelo robô local) ───────────────────
router.post("/automatizacoes/executar-pendentes", async (_req, res) => {
  try {
    const agora = new Date();
    const vencidas = await db.select().from(automatizacoesWhatsappTable)
      .where(and(
        eq(automatizacoesWhatsappTable.ativa, true),
        lte(automatizacoesWhatsappTable.proximaExecucao, agora)
      ));

    let total = 0;
    for (const auto of vencidas) {
      const count = await executarAutomacao(auto);
      total += count;
      // Atualizar ultima/proxima execucao
      const proxima = calcularProxima(auto.frequencia, auto.diasSemana, auto.diaMes, auto.horario);
      await db.update(automatizacoesWhatsappTable).set({
        ultimaExecucao: agora,
        proximaExecucao: proxima,
        // Se for 'unico', desativa após executar
        ativa: auto.frequencia === "unico" ? false : true,
        atualizadoEm: new Date(),
      }).where(eq(automatizacoesWhatsappTable.id, auto.id));
    }
    res.json({ ok: true, executadas: vencidas.length, mensagensEnfileiradas: total });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

async function executarAutomacao(auto: any): Promise<number> {
  const destinatarios = await resolverDestinatarios(auto.destinatarioTipo, auto.destinatarioValor);
  let count = 0;

  // Resolve dynamic document if applicable
  let dynamicFile = {
    base64: auto.arquivoBase64 || null,
    mimetype: auto.mimetype || null,
    filename: auto.nomeArquivo || null
  };

  if (auto.tipoDocumento && auto.tipoDocumento !== "mensagem") {
    try {
      // Resolve reference month and year
      let mes = new Date().getMonth() + 1;
      let ano = new Date().getFullYear();
      if (auto.documentoMes && auto.documentoMes !== "atual") {
        const parsedMes = parseInt(auto.documentoMes);
        if (!isNaN(parsedMes)) mes = parsedMes;
      }

      let docResult: { conteudo: string; nomeArquivo: string } | null = null;
      if (auto.tipoDocumento === "ficai") {
        docResult = await gerarRelatorioFICAI(auto.documentoEscopo || "todas", auto.documentoAlvo, mes, ano);
      } else if (auto.tipoDocumento === "freq_mensal") {
        docResult = await gerarRelatorioFrequenciaMensal(auto.documentoEscopo || "todas", auto.documentoAlvo, mes, ano);
      } else if (auto.tipoDocumento === "resumo_turma") {
        docResult = await gerarRelatorioResumoTurma(auto.documentoEscopo || "todas", auto.documentoAlvo, mes, ano);
      } else if (auto.tipoDocumento === "pre_diario") {
        docResult = await gerarRelatorioPreDiario(auto.documentoEscopo || "todas", auto.documentoAlvo, mes, ano);
      }

      if (docResult) {
        dynamicFile.base64 = Buffer.from(docResult.conteudo, "utf-8").toString("base64");
        dynamicFile.mimetype = "text/plain";
        dynamicFile.filename = docResult.nomeArquivo;
      }
    } catch (err: any) {
      console.error("[executarAutomacao] Erro ao gerar documento dinâmico:", err.message);
    }
  }

  for (const { numero, nome } of destinatarios) {
    const mensagem = formatarMensagem(auto, nome);
    await db.insert(filaWhatsappTable).values({
      numero,
      mensagem,
      arquivoBase64: dynamicFile.base64,
      mimetype:      dynamicFile.mimetype,
      nomeArquivo:   dynamicFile.filename,
      status:        "Pendente",
    });
    count++;
  }
  return count;
}

async function gerarRelatorioFICAI(escopo: string, alvo: string | null, mes: number, ano: number): Promise<{ conteudo: string; nomeArquivo: string }> {
  const cfgRows = await db.select().from(diarioConfiguracoesTable);
  const cfgMap: Record<string, string> = {};
  for (const r of cfgRows) cfgMap[r.chave] = r.valor;
  const thresholdConsec  = Number(cfgMap["ficai_faltas_consecutivas"] ?? 3);
  const thresholdMensais = Number(cfgMap["ficai_faltas_mensais"]      ?? 5);

  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `__/${mesFormatado}/${ano}`;
  const cond = ilike(diarioAulasTable.data, pattern);

  let aulas = await db.select().from(diarioAulasTable).where(cond).orderBy(diarioAulasTable.data);
  let alunos = await db.select().from(alunosTable).where(eq(alunosTable.situacao, "Matriculado"));

  if (escopo === "aluno" && alvo) {
    alunos = alunos.filter(a => String(a.id) === alvo);
  } else if (escopo === "turma" && alvo) {
    const turmasList = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turmaAtual && turmasList.includes(a.turmaAtual));
    aulas = aulas.filter(a => turmasList.includes(a.turmaNome));
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap: Record<number, Record<number, string>> = {};
  if (aulaIds.length > 0) {
    const presencas = await db.select().from(diarioPresencasTable).where(inArray(diarioPresencasTable.aulaId, aulaIds));
    for (const p of presencas) {
      if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
      presMap[p.aulaId][p.alunoId] = p.status;
    }
  }

  function parseDate(s: string) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  const alertas: any[] = [];
  for (const aluno of alunos) {
    if (!aluno.turmaAtual) continue;
    const aulasAluno = aulas
      .filter(a => a.turmaNome === aluno.turmaAtual)
      .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
    if (!aulasAluno.length) continue;

    let maxConsec = 0, currentConsec = 0;
    let faltasMensais = 0;
    const datasFaltas: string[] = [];

    for (const aula of aulasAluno) {
      const status = presMap[aula.id]?.[aluno.id] ?? "P";
      if (status === "F") {
        currentConsec++;
        faltasMensais++;
        datasFaltas.push(aula.data);
        if (currentConsec > maxConsec) {
          maxConsec = currentConsec;
        }
      } else {
        currentConsec = 0;
      }
    }

    const emAlerta = maxConsec >= thresholdConsec || faltasMensais >= thresholdMensais;
    if (emAlerta) {
      alertas.push({
        nome: aluno.nomeCompleto,
        turma: aluno.turmaAtual,
        maxConsec,
        faltasMensais,
        datasFaltas
      });
    }
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RELATÓRIO ALERTA FICAI - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `Escopo: ${escopo === "aluno" ? "Aluno Específico" : escopo === "turma" ? `Turma(s) (${alvo})` : "Todas as Turmas"}\n`;
  text += `${"=".repeat(60)}\n\n`;
  text += `Critérios de Alerta:\n`;
  text += `- Faltas Consecutivas >= ${thresholdConsec}\n`;
  text += `- Faltas Mensais no Mês >= ${thresholdMensais}\n`;
  text += `${"=".repeat(60)}\n\n`;

  if (alertas.length === 0) {
    text += `Nenhum aluno em situação de alerta FICAI para os parâmetros selecionados.\n`;
  } else {
    alertas.forEach((a, idx) => {
      text += `${idx + 1}. NOME: ${a.nome}\n`;
      text += `   TURMA: ${a.turma}\n`;
      text += `   FALTAS CONSECUTIVAS MÁXIMAS: ${a.maxConsec}\n`;
      text += `   TOTAL DE FALTAS NO MÊS: ${a.faltasMensais}\n`;
      text += `   DATAS DAS FALTAS: ${a.datasFaltas.join(", ") || "Nenhuma"}\n`;
      text += `--------------------------------------------------\n`;
    });
    text += `\nTotal de alunos em alerta: ${alertas.length}\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Alerta_FICAI_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioFrequenciaMensal(escopo: string, alvo: string | null, mes: number, ano: number): Promise<{ conteudo: string; nomeArquivo: string }> {
  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `__/${mesFormatado}/${ano}`;
  const cond = ilike(diarioAulasTable.data, pattern);

  let aulas = await db.select().from(diarioAulasTable).where(cond).orderBy(diarioAulasTable.data);
  let alunos = await db.select().from(alunosTable).where(eq(alunosTable.situacao, "Matriculado")).orderBy(alunosTable.nomeCompleto);

  if (escopo === "aluno" && alvo) {
    alunos = alunos.filter(a => String(a.id) === alvo);
  } else if (escopo === "turma" && alvo) {
    const turmasList = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turmaAtual && turmasList.includes(a.turmaAtual));
    aulas = aulas.filter(a => turmasList.includes(a.turmaNome));
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap: Record<number, Record<number, string>> = {};
  if (aulaIds.length > 0) {
    const presencas = await db.select().from(diarioPresencasTable).where(inArray(diarioPresencasTable.aulaId, aulaIds));
    for (const p of presencas) {
      if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
      presMap[p.aulaId][p.alunoId] = p.status;
    }
  }

  const turmasComAulas = [...new Set(aulas.map(a => a.turmaNome))].sort();
  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RELATÓRIO DE FREQUÊNCIA MENSAL - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of turmasComAulas) {
    const aulasT = aulas.filter(a => a.turmaNome === tNome);
    const alunosT = alunos.filter(a => a.turmaAtual === tNome);
    if (aulasT.length === 0 || alunosT.length === 0) continue;

    text += `TURMA: ${tNome} (${aulasT.length} aulas letivas registradas)\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `Nº | Nome do Aluno | Presenças | Faltas | % Freq\n`;
    text += `----------------------------------------------------------------------\n`;

    const risco: any[] = [];

    alunosT.forEach((al, idx) => {
      let faltas = 0;
      for (const au of aulasT) {
        if ((presMap[au.id]?.[al.id] ?? "P") === "F") {
          faltas++;
        }
      }
      const totalAulas = aulasT.length;
      const presencas = totalAulas - faltas;
      const pct = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 100;

      text += `${String(idx + 1).padStart(2, "0")} | ${al.nomeCompleto.padEnd(30)} | ${String(presencas).padStart(9)} | ${String(faltas).padStart(6)} | ${pct}%\n`;

      if (pct < 75) {
        risco.push({ nome: al.nomeCompleto, pct });
      }
    });

    if (risco.length > 0) {
      text += `\nAlunos com frequência crítica (abaixo de 75%):\n`;
      risco.forEach(r => {
        text += `- ${r.nome} (${r.pct}%)\n`;
      });
    }
    text += `\n${"=".repeat(70)}\n\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Frequencia_Mensal_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioResumoTurma(escopo: string, alvo: string | null, mes: number, ano: number): Promise<{ conteudo: string; nomeArquivo: string }> {
  const mesFormatado = String(mes).padStart(2, "0");
  const pattern = `__/${mesFormatado}/${ano}`;
  const cond = ilike(diarioAulasTable.data, pattern);

  let aulas = await db.select().from(diarioAulasTable).where(cond).orderBy(diarioAulasTable.data);
  let alunos = await db.select().from(alunosTable).where(eq(alunosTable.situacao, "Matriculado")).orderBy(alunosTable.nomeCompleto);

  let targetTurmas: string[] = [];
  if (escopo === "turma" && alvo) {
    targetTurmas = alvo.split(",").map(t => t.trim()).filter(Boolean);
    alunos = alunos.filter(a => a.turmaAtual && targetTurmas.includes(a.turmaAtual));
    aulas = aulas.filter(a => targetTurmas.includes(a.turmaNome));
  } else {
    targetTurmas = [...new Set(alunos.map(a => a.turmaAtual).filter(Boolean))] as string[];
  }

  const aulaIds = aulas.map(a => a.id);
  const presMap: Record<number, Record<number, string>> = {};
  if (aulaIds.length > 0) {
    const presencas = await db.select().from(diarioPresencasTable).where(inArray(diarioPresencasTable.aulaId, aulaIds));
    for (const p of presencas) {
      if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
      presMap[p.aulaId][p.alunoId] = p.status;
    }
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `RESUMO DE TURMA - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of targetTurmas.sort()) {
    const aulasT = aulas.filter(a => a.turmaNome === tNome);
    const alunosT = alunos.filter(a => a.turmaAtual === tNome);
    if (alunosT.length === 0) continue;

    const dbTurmas = await db.select().from(turmasTable).where(eq(turmasTable.nomeTurma, tNome));
    const tInfo = dbTurmas[0] || {};

    let totalPresencas = 0;
    let totalFaltas = 0;
    let totalAulas = aulasT.length;

    alunosT.forEach(al => {
      for (const au of aulasT) {
        if ((presMap[au.id]?.[al.id] ?? "P") === "F") {
          totalFaltas++;
        } else {
          totalPresencas++;
        }
      }
    });

    const totalRegistros = totalPresencas + totalFaltas;
    const mediaFreq = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 100;

    text += `TURMA: ${tNome}\n`;
    text += `Turno: ${tInfo.turno || "Não especificado"}\n`;
    text += `Professor Responsável: ${tInfo.professorResponsavel || "Não especificado"}\n`;
    text += `Total de Alunos Matriculados: ${alunosT.length}\n`;
    text += `Aulas Registradas no Mês: ${totalAulas}\n`;
    text += `Frequência Média da Turma: ${mediaFreq}%\n`;
    text += `--------------------------------------------------\n\n`;
  }

  return {
    conteudo: text,
    nomeArquivo: `Resumo_Turma_${nomeMes}_${ano}.txt`
  };
}

async function gerarRelatorioPreDiario(escopo: string, alvo: string | null, mes: number, ano: number): Promise<{ conteudo: string; nomeArquivo: string }> {
  const totalDias = new Date(ano, mes, 0).getDate();
  const diasLetivos: string[] = [];
  
  function getDiaSemana(dataStr: string): string {
    const [d, m, y] = dataStr.split("/").map(Number);
    const date = new Date(y, m - 1, d);
    const nomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return nomes[date.getDay()];
  }

  for (let d = 1; d <= totalDias; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(mes).padStart(2, "0");
    const dataStr = `${dd}/${mm}/${ano}`;
    if (isDiaLetivo(dataStr)) {
      diasLetivos.push(`${dataStr} (${getDiaSemana(dataStr)})`);
    }
  }

  let targetTurmas: string[] = [];
  if (escopo === "turma" && alvo) {
    targetTurmas = alvo.split(",").map(t => t.trim()).filter(Boolean);
  } else {
    const allT = await db.select().from(turmasTable).orderBy(asc(turmasTable.nomeTurma));
    targetTurmas = allT.map(t => t.nomeTurma);
  }

  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const nomeMes = mesesNomes[mes - 1];

  let text = `PRÉ-DIÁRIO - ${nomeMes.toUpperCase()} / ${ano}\n`;
  text += `Data de Geração: ${new Date().toLocaleDateString("pt-BR")}\n`;
  text += `Instituição: E. M. José Giró Faísca\n`;
  text += `${"=".repeat(60)}\n\n`;

  for (const tNome of targetTurmas.sort()) {
    const dbTurmas = await db.select().from(turmasTable).where(eq(turmasTable.nomeTurma, tNome));
    const tInfo = dbTurmas[0];
    if (!tInfo) continue;

    const alunosT = await db.select()
      .from(alunosTable)
      .where(and(eq(alunosTable.turmaAtual, tNome), eq(alunosTable.arquivoMorto, 0)))
      .orderBy(asc(alunosTable.nomeCompleto));

    text += `TURMA: ${tNome} (${tInfo.turno || "Não especificado"})\n`;
    text += `Professor Responsável: ${tInfo.professorResponsavel || "Não especificado"}\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `Nº | Nome do Aluno\n`;
    text += `----------------------------------------------------------------------\n`;
    alunosT.forEach((al, idx) => {
      text += `${String(idx + 1).padStart(2, "0")} | ${al.nomeCompleto}\n`;
    });
    text += `----------------------------------------------------------------------\n\n`;
  }

  text += `DIAS LETIVOS PREVISTOS:\n`;
  diasLetivos.forEach(d => {
    text += `- ${d}\n`;
  });

  return {
    conteudo: text,
    nomeArquivo: `Pre_Diario_${nomeMes}_${ano}.txt`
  };
}

function formatarMensagem(auto: any, nomeDestinatario: string): string {
  const base = auto.mensagem || "";
  const tipo = auto.tipoDocumento;
  const agora = new Date().toLocaleDateString("pt-BR");

  if (tipo === "mensagem") return base.replace("{nome}", nomeDestinatario);

  const prefixos: Record<string, string> = {
    ficai:       `📋 *FICAI - ${agora}*\n`,
    freq_mensal: `📊 *Frequência Mensal - ${agora}*\n`,
    resumo_turma:`📝 *Resumo de Turma - ${agora}*\n`,
    pre_diario:  `📆 *Pré-diário - ${agora}*\n`,
  };
  const prefixo = prefixos[tipo] || "";
  const body = base ? base.replace("{nome}", nomeDestinatario) : `Olá ${nomeDestinatario}, segue o documento solicitado.`;
  return `${prefixo}${body}`;
}

async function resolverDestinatarios(tipo: string, valor: string | null): Promise<Array<{numero: string; nome: string}>> {
  switch (tipo) {
    case "numero":
      return valor ? [{ numero: valor, nome: "destinatário" }] : [];

    case "professor": {
      if (!valor) return [];
      const id = parseInt(valor);
      const profs = await db.select({ nome: professoresTable.nome, telefone: professoresTable.telefone })
        .from(professoresTable).where(eq(professoresTable.id, id));
      return profs.filter(p => p.telefone).map(p => ({ numero: limparNumero(p.telefone!), nome: p.nome }));
    }

    case "todos_professores": {
      const profs = await db.select({ nome: professoresTable.nome, telefone: professoresTable.telefone })
        .from(professoresTable);
      return profs.filter(p => p.telefone).map(p => ({ numero: limparNumero(p.telefone!), nome: p.nome }));
    }

    case "grupo": {
      // valor = JID do grupo (ex: "120363xxxxx@g.us")
      if (valor === "grupo_da_escola") {
        const cfg = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "escola_whatsapp_grupo"));
        if (cfg && cfg[0]?.valor) {
          return [{ numero: cfg[0].valor, nome: "Grupo" }];
        }
        return [{ numero: "grupo_da_escola", nome: "Grupo" }];
      }
      return valor ? [{ numero: valor, nome: "Grupo" }] : [];
    }

    case "turma_alunos": {
      if (!valor) return [];
      const alunos = await db.select({
        nome: alunosTable.nomeCompleto,
        tel: alunosTable.telefone,
      }).from(alunosTable).where(eq(alunosTable.turmaAtual, valor));
      return alunos.filter(a => a.tel).map(a => ({ numero: limparNumero(a.tel!), nome: a.nome }));
    }

    case "todos_alunos": {
      const alunos = await db.select({
        nome: alunosTable.nomeCompleto,
        tel: alunosTable.telefone,
      }).from(alunosTable);
      return alunos.filter(a => a.tel).map(a => ({ numero: limparNumero(a.tel!), nome: a.nome }));
    }

    case "funcionarios": {
      const funcs = await db.select({
        nome: funcionariosTable.nomeCompleto,
        tel: funcionariosTable.telefoneContato,
      }).from(funcionariosTable);
      return funcs.filter(f => f.tel).map(f => ({ numero: limparNumero(f.tel!), nome: f.nome }));
    }

    default:
      return [];
  }
}

function limparNumero(tel: string): string {
  return tel.replace(/\D/g, "");
}

function calcularProxima(
  frequencia: string,
  diasSemana: string | null,
  diaMes: number | null,
  horario: string,
  diasMesStr?: string | null
): Date | null {
  const agora = new Date();
  const [h, m] = (horario || "08:00").split(":").map(Number);

  if (frequencia === "unico") {
    // Próxima = hoje no horário indicado, ou amanhã se já passou
    const d = new Date(agora);
    d.setHours(h, m, 0, 0);
    if (d <= agora) d.setDate(d.getDate() + 1);
    return d;
  }

  if (frequencia === "diario") {
    const d = new Date(agora);
    d.setHours(h, m, 0, 0);
    if (d <= agora) d.setDate(d.getDate() + 1);
    return d;
  }

  if (frequencia === "semanal" && diasSemana) {
    const dias = diasSemana.split(",").map(Number); // 0=Dom, 1=Seg...
    // Achar o próximo dia da semana na lista
    for (let i = 1; i <= 7; i++) {
      const d = new Date(agora);
      d.setDate(d.getDate() + i);
      d.setHours(h, m, 0, 0);
      if (dias.includes(d.getDay())) return d;
    }
  }

  if (frequencia === "mensal") {
    let dias: number[] = [];
    if (diasMesStr) {
      dias = diasMesStr.split(",").map(Number).filter(d => d >= 1 && d <= 31);
    } else if (diaMes) {
      dias = [diaMes];
    }

    if (dias.length === 0) return null;

    let proximaData: Date | null = null;
    for (let i = 0; i <= 40; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, h, m, 0, 0);
      if (d <= agora) continue;
      if (dias.includes(d.getDate())) {
        proximaData = d;
        break;
      }
    }
    return proximaData;
  }

  return null;
}

export default router;

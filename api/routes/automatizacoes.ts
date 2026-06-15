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
} from "../lib/db/index.ts";
import { eq, and, lte, ilike } from "drizzle-orm";

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
    const proxima = calcularProxima(data.frequencia, data.diasSemana, data.diaMes, data.horario);
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
    const proxima = calcularProxima(data.frequencia, data.diasSemana, data.diaMes, data.horario);
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
  for (const { numero, nome } of destinatarios) {
    const mensagem = formatarMensagem(auto, nome);
    await db.insert(filaWhatsappTable).values({
      numero,
      mensagem,
      arquivoBase64: auto.arquivoBase64 || null,
      mimetype:      auto.mimetype || null,
      nomeArquivo:   auto.nomeArquivo || null,
      status:        "Pendente",
    });
    count++;
  }
  return count;
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
  horario: string
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

  if (frequencia === "mensal" && diaMes) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), diaMes, h, m, 0, 0);
    if (d <= agora) {
      // Próximo mês
      d.setMonth(d.getMonth() + 1);
    }
    return d;
  }

  return null;
}

export default router;

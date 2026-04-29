// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.ts";
import { alunosTable, professoresTable, funcionariosTable } from "../lib/db/index.ts/schema";
import { isNotNull } from "drizzle-orm";
import { DIAS_NAO_LETIVOS_2026 } from "../lib/calendario2026";

const router = Router();

function parseDDMM(data: string): { dia: number; mes: number } | null {
  if (!data) return null;
  const parts = data.split("/");
  if (parts.length < 2) return null;
  const dia = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10);
  if (isNaN(dia) || isNaN(mes) || dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return { dia, mes };
}

// GET /api/calendario/mes?mes=3&ano=2026
// Retorna eventos (aniversariantes + feriados/recesso) de cada dia do mês
router.get("/calendario/mes", async (req, res) => {
  try {
    const mes = parseInt(req.query.mes as string, 10);
    const ano = parseInt(req.query.ano as string, 10) || new Date().getFullYear();

    if (isNaN(mes) || mes < 1 || mes > 12) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido (1-12)" });
    }

    const diasNoMes = new Date(ano, mes, 0).getDate();

    type DiaEvento = {
      aniversariantes: { nome: string; tipo: string; info: string; id?: number }[];
      evento: { tipo: string; descricao: string } | null;
    };

    const dias: Record<number, DiaEvento> = {};
    for (let d = 1; d <= diasNoMes; d++) {
      const chave = `${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
      const evento = DIAS_NAO_LETIVOS_2026[chave] ?? null;
      dias[d] = { aniversariantes: [], evento: evento ? { tipo: evento.tipo, descricao: evento.descricao } : null };
    }

    const [listaAlunos, listaProfessores, listaFunc] = await Promise.all([
      db.select({
        id: alunosTable.id,
        nome: alunosTable.nomeCompleto,
        turma: alunosTable.turmaAtual,
        dn: alunosTable.dataNascimento,
      }).from(alunosTable).where(isNotNull(alunosTable.dataNascimento)),

      db.select({
        nome: professoresTable.nome,
        dn: professoresTable.dataNascimento,
      }).from(professoresTable).where(isNotNull(professoresTable.dataNascimento)),

      db.select({
        nome: funcionariosTable.nomeCompleto,
        funcao: funcionariosTable.funcao,
      }).from(funcionariosTable),
    ]);

    for (const a of listaAlunos) {
      const dm = parseDDMM(a.dn ?? "");
      if (!dm || dm.mes !== mes || !dias[dm.dia]) continue;
      dias[dm.dia].aniversariantes.push({
        nome: a.nome, tipo: "aluno", info: a.turma || "S/Turma", id: a.id ?? undefined,
      });
    }

    for (const p of listaProfessores) {
      const dm = parseDDMM(p.dn ?? "");
      if (!dm || dm.mes !== mes || !dias[dm.dia]) continue;
      dias[dm.dia].aniversariantes.push({
        nome: p.nome, tipo: "professor", info: "Professor(a)",
      });
    }

    for (const f of listaFunc) {
      const dn = (f as any).dataNascimento ?? (f as any).data_nascimento ?? "";
      const dm = parseDDMM(dn);
      if (!dm || dm.mes !== mes || !dias[dm.dia]) continue;
      dias[dm.dia].aniversariantes.push({
        nome: f.nome, tipo: "funcionario", info: (f as any).funcao || "Funcionário(a)",
      });
    }

    // Retorna apenas dias com algum evento para economizar payload
    const result: Record<string, DiaEvento> = {};
    for (const [d, data] of Object.entries(dias)) {
      if (data.aniversariantes.length > 0 || data.evento !== null) {
        result[d] = data;
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar calendário" });
  }
});

export default router;

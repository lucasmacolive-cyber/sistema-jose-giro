// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { alunosTable, professoresTable, funcionariosTable } from "@workspace/db/schema";
import { isNotNull } from "drizzle-orm";

const router = Router();

interface Aniversariante {
  id?: number;           // id do registro (aluno, professor, funcionário)
  nome: string;
  tipo: "aluno" | "professor" | "funcionario";
  info: string;          // turma (aluno) | "Professor(a)" | função (funcionário)
  diaMes: string;        // "DD/MM"
  diasAte: number;       // 0 = hoje
}

function parseDDMM(data: string): { dia: number; mes: number } | null {
  if (!data) return null;
  const parts = data.split("/");
  if (parts.length < 2) return null;
  const dia = parseInt(parts[0], 10);
  const mes = parseInt(parts[1], 10);
  if (isNaN(dia) || isNaN(mes) || dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return { dia, mes };
}

function diasAteAniversario(dia: number, mes: number, hoje: Date): number {
  const anoHoje = hoje.getFullYear();
  let proximo = new Date(anoHoje, mes - 1, dia);
  if (proximo < hoje) proximo = new Date(anoHoje + 1, mes - 1, dia);
  const diffMs = proximo.getTime() - hoje.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

router.get("/aniversariantes", async (_req, res) => {
  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [listaAlunos, listaProfessores, listaFuncionarios] = await Promise.all([
      db.select().from(alunosTable).where(isNotNull(alunosTable.dataNascimento)),
      db.select().from(professoresTable).where(isNotNull(professoresTable.dataNascimento)),
      db.select().from(funcionariosTable),
    ]);

    const todos: Aniversariante[] = [];

    for (const a of listaAlunos) {
      const dm = parseDDMM(a.dataNascimento ?? "");
      if (!dm) continue;
      const diasAte = diasAteAniversario(dm.dia, dm.mes, hoje);
      if (diasAte > 30) continue;
      todos.push({
        id: a.id,
        nome: a.nomeCompleto,
        tipo: "aluno",
        info: a.turmaAtual || "S/Turma",
        diaMes: `${String(dm.dia).padStart(2, "0")}/${String(dm.mes).padStart(2, "0")}`,
        diasAte,
      });
    }

    for (const p of listaProfessores) {
      const dm = parseDDMM(p.dataNascimento ?? "");
      if (!dm) continue;
      const diasAte = diasAteAniversario(dm.dia, dm.mes, hoje);
      if (diasAte > 30) continue;
      todos.push({
        nome: p.nome,
        tipo: "professor",
        info: "Professor(a)",
        diaMes: `${String(dm.dia).padStart(2, "0")}/${String(dm.mes).padStart(2, "0")}`,
        diasAte,
      });
    }

    for (const f of listaFuncionarios) {
      const dn = (f as any).dataNascimento ?? (f as any).data_nascimento ?? "";
      if (!dn) continue;
      const dm = parseDDMM(dn);
      if (!dm) continue;
      const diasAte = diasAteAniversario(dm.dia, dm.mes, hoje);
      if (diasAte > 30) continue;
      todos.push({
        nome: f.nomeCompleto,
        tipo: "funcionario",
        info: f.funcao || "Funcionário(a)",
        diaMes: `${String(dm.dia).padStart(2, "0")}/${String(dm.mes).padStart(2, "0")}`,
        diasAte,
      });
    }

    todos.sort((a, b) => a.diasAte - b.diasAte);

    const hoje_ = todos.filter(a => a.diasAte === 0);
    const semana = todos.filter(a => a.diasAte >= 1 && a.diasAte <= 6);
    const mes    = todos.filter(a => a.diasAte >= 7 && a.diasAte <= 30);

    res.json({ hoje: hoje_, semana, mes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar aniversariantes" });
  }
});

export default router;

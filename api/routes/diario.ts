// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.ts";
import {
  diarioAulasTable, diarioPresencasTable, diarioConfiguracoesTable,
  turmasTable, alunosTable, professoresTable
} from "../lib/db/index.ts";
import { eq, and, inArray, or, sql } from "drizzle-orm";
import { parseDiarioTexto } from "../lib/parseDiario";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ ok: false, mensagem: "Não autenticado" });
  next();
}

/* ─── GET /diario/relatorio-frequencia-mensal (Público/WhatsApp) ─── */
function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "---";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

router.get("/diario/relatorio-frequencia-mensal", async (req, res) => {
  try {
    const { mes, ano, turma } = req.query;
    if (!mes || !ano) {
      return res.status(400).send("<h1>Parâmetros inválidos</h1><p>Os parâmetros 'mes' e 'ano' são obrigatórios.</p>");
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    };
    const hojeStr = new Intl.DateTimeFormat("pt-BR", options).format(new Date());

    function parseDate(s: string) {
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    function dateLE(a: string, b: string) {
      return parseDate(a).getTime() <= parseDate(b).getTime();
    }

    const mesFormatado = String(mes).padStart(2, "0");
    const pattern = `__/${mesFormatado}/${ano}`;
    const cond = sql`${diarioAulasTable.data} LIKE ${pattern}`;

    let turmaCond: any = undefined;
    let alunosCond: any = eq(alunosTable.situacao, "Matriculado");

    if (turma) {
      const turmasList = String(turma).split(",").map(t => t.trim()).filter(Boolean);
      if (turmasList.length === 1) {
        turmaCond = eq(diarioAulasTable.turmaNome, turmasList[0]);
        alunosCond = and(eq(alunosTable.situacao, "Matriculado"), eq(alunosTable.turmaAtual, turmasList[0]));
      } else if (turmasList.length > 1) {
        turmaCond = inArray(diarioAulasTable.turmaNome, turmasList);
        alunosCond = and(eq(alunosTable.situacao, "Matriculado"), inArray(alunosTable.turmaAtual, turmasList));
      }
    }

    // 1. Aulas do mês
    const allAulas = await db
      .select()
      .from(diarioAulasTable)
      .where(turmaCond ? and(turmaCond, cond) : cond)
      .orderBy(diarioAulasTable.data);

    const aulasPassadas = allAulas.filter(a => dateLE(a.data, hojeStr));

    // 2. Alunos
    const queryAlunos = db
      .select()
      .from(alunosTable)
      .where(alunosCond)
      .orderBy(alunosTable.nomeCompleto);

    const alunos = await queryAlunos;

    // 3. Presenças
    const aulaIds = aulasPassadas.map(a => a.id);
    const presMap: Record<number, Record<number, string>> = {};
    if (aulaIds.length > 0) {
      const presencas = await db
        .select()
        .from(diarioPresencasTable)
        .where(inArray(diarioPresencasTable.aulaId, aulaIds));
      for (const p of presencas) {
        if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
        presMap[p.aulaId][p.alunoId] = p.status;
      }
    }

    // Agrupar e calcular estatísticas por turma
    const turmasComAulas = [...new Set(aulasPassadas.map(a => a.turmaNome))].sort();

    const relatorioPorTurma: {
      turma: string;
      totalAlunos: number;
      reprovados: any[];
      risco: any[];
    }[] = [];

    for (const tNome of turmasComAulas) {
      const aulasT = aulasPassadas.filter(a => a.turmaNome === tNome);
      const alunosT = alunos.filter(a => a.turmaAtual === tNome);
      if (aulasT.length === 0 || alunosT.length === 0) continue;

      const reprovados: any[] = [];
      const risco: any[] = [];

      for (const al of alunosT) {
        let faltas = 0;
        for (const au of aulasT) {
          if ((presMap[au.id]?.[al.id] ?? "P") === "F") {
            faltas++;
          }
        }
        const totalAulas = aulasT.length;
        const presencas = totalAulas - faltas;
        const pct = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 100;

        const info = {
          nome: al.nomeCompleto,
          cpf: formatCPF(al.cpf),
          presencas,
          totalAulas,
          faltas,
          pct
        };

        if (pct < 50) {
          reprovados.push(info);
        } else if (pct < 75) {
          risco.push(info);
        }
      }

      relatorioPorTurma.push({
        turma: tNome,
        totalAlunos: alunosT.length,
        reprovados,
        risco
      });
    }

    const nomesMeses = [
      "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const nomeMes = nomesMeses[Number(mes)] || mes;

    // Gerar HTML
    let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Mensal de Frequência - ${nomeMes}/${ano}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --danger: #ef4444;
      --danger-bg: #fee2e2;
      --warning: #f59e0b;
      --warning-bg: #fef3c7;
      --success: #10b981;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #1e3a8a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', sans-serif;
      color: var(--text-main);
      background-color: #f8fafc;
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 3rem;
      border-radius: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05);
      border: 1px solid var(--border);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 1.25rem;
      margin-bottom: 2rem;
    }
    .cab-info {
      font-size: 1rem;
    }
    .cab-info .pref {
      font-size: 0.9rem;
      color: var(--text-muted);
      font-weight: 500;
    }
    .cab-info .escola {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--primary);
      margin-top: 0.25rem;
      letter-spacing: -0.5px;
    }
    .logo {
      width: 70px;
      height: 70px;
      object-fit: contain;
    }
    .report-title-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .report-title-container h2 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: -0.5px;
    }
    .badge-date {
      background-color: #e2e8f0;
      color: #334155;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 700;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }
    .btn-print {
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 0.75rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2);
    }
    .btn-print:hover {
      background-color: #172554;
      transform: translateY(-1px);
    }
    
    .turma-section {
      margin-bottom: 3.5rem;
      page-break-inside: avoid;
    }
    .turma-title {
      font-size: 1.35rem;
      font-weight: 800;
      border-bottom: 2px solid var(--border);
      padding-bottom: 0.75rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #1e293b;
    }
    .turma-badge {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-muted);
      background-color: #f1f5f9;
      padding: 0.25rem 0.75rem;
      border-radius: 0.5rem;
    }
    
    .table-container {
      margin-bottom: 2rem;
      border: 1px solid var(--border);
      border-radius: 1rem;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
    }
    .group-title {
      font-size: 0.95rem;
      font-weight: 700;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .group-title.danger {
      background-color: #fff1f2;
      color: #be123c;
    }
    .group-title.warning {
      background-color: #fffbeb;
      color: #b45309;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    th, td {
      padding: 1rem 1.25rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tr:last-child td {
      border-bottom: none;
    }
    
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    
    .badge-pct {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-weight: 700;
      font-size: 0.9rem;
    }
    .badge-pct.danger {
      background-color: #fee2e2;
      color: #ef4444;
    }
    .badge-pct.warning {
      background-color: #fef3c7;
      color: #d97706;
    }
    
    .no-data {
      color: var(--success);
      font-weight: 600;
      padding: 1.5rem;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #f0fdf4;
      border-radius: 1rem;
      border: 1px solid #bbf7d0;
      margin-bottom: 2rem;
    }
    
    .footer-signature {
      margin-top: 6rem;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      gap: 2rem;
    }
    .signature-line {
      width: 45%;
      border-top: 1.5px solid #475569;
      text-align: center;
      padding-top: 0.75rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: #475569;
    }
    
    @media print {
      body { background-color: white; padding: 0; }
      .container { box-shadow: none; padding: 0; max-width: 100%; border: none; }
      .no-print { display: none !important; }
      .group-title.danger { background-color: #fff1f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .group-title.warning { background-color: #fffbeb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-data { background-color: #f0fdf4 !important; border: 1px solid #bbf7d0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge-pct.danger { background-color: #fee2e2 !important; color: #ef4444 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge-pct.warning { background-color: #fef3c7 !important; color: #d97706 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media screen and (max-width: 768px) {
      body {
        padding: 0.5rem;
      }
      .container {
        padding: 1.25rem 0.75rem;
        border-radius: 0.75rem;
      }
      .header {
        flex-direction: column;
        text-align: center;
        align-items: center;
      }
      .logo {
        margin-top: 1rem;
      }
      .report-title-container {
        flex-direction: column;
        align-items: flex-start;
      }
      .report-title-container > div {
        width: 100%;
        flex-direction: column;
        align-items: stretch !important;
      }
      .btn-print {
        justify-content: center;
      }
      .table-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      table {
        min-width: 650px;
      }
      th, td {
        padding: 0.75rem 0.5rem;
      }
      .footer-signature {
        flex-direction: column;
        gap: 3rem;
        margin-top: 4rem;
      }
      .signature-line {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="cab-info">
        <p class="pref">Prefeitura do Município de Campos dos Goytacazes</p>
        <p class="pref">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
        <p class="escola">E. M. José Giró Faísca</p>
      </div>
      <img class="logo" src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" alt="Logo">
    </div>

    <div class="report-title-container">
      <h2>Resumo Mensal de Frequência - Alunos Críticos (&lt; 75%)</h2>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="badge-date">Referência: ${nomeMes} de ${ano}</span>
        <button class="btn-print no-print" onclick="window.print()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-6a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2m-12 0v5h8v-5m-8 0h8"/></svg>
          Imprimir / Salvar PDF
        </button>
      </div>
    </div>

    ${relatorioPorTurma.map(rt => `
      <div class="turma-section">
        <div class="turma-title">
          <span>Turma: ${rt.turma}</span>
          <span class="turma-badge">${rt.totalAlunos} alunos matriculados</span>
        </div>

        ${rt.reprovados.length === 0 && rt.risco.length === 0 ? `
          <div class="no-data">✓ Nenhum aluno em situação de risco ou reprovação por falta nesta turma.</div>
        ` : `
          ${rt.reprovados.length > 0 ? `
            <div class="table-container">
              <div class="group-title danger">🔴 Reprovados por Falta (Frequência &lt; 50%)</div>
              <table>
                <thead>
                  <tr>
                    <th>Nome do Aluno</th>
                    <th style="width: 160px;">CPF</th>
                    <th style="width: 150px;" class="text-center">Presenças / Total</th>
                    <th style="width: 100px;" class="text-center">Faltas</th>
                    <th style="width: 120px;" class="text-right">Frequência</th>
                  </tr>
                </thead>
                <tbody>
                  ${rt.reprovados.map(al => `
                    <tr>
                      <td><strong>${al.nome}</strong></td>
                      <td>${al.cpf}</td>
                      <td class="text-center">${al.presencas} / ${al.totalAulas}</td>
                      <td class="text-center">${al.faltas}</td>
                      <td class="text-right">
                        <span class="badge-pct danger">${al.pct}%</span>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : ""}

          ${rt.risco.length > 0 ? `
            <div class="table-container">
              <div class="group-title warning">🟡 Em Risco de Reprovação (Frequência 50% - 74%)</div>
              <table>
                <thead>
                  <tr>
                    <th>Nome do Aluno</th>
                    <th style="width: 160px;">CPF</th>
                    <th style="width: 150px;" class="text-center">Presenças / Total</th>
                    <th style="width: 100px;" class="text-center">Faltas</th>
                    <th style="width: 120px;" class="text-right">Frequência</th>
                  </tr>
                </thead>
                <tbody>
                  ${rt.risco.map(al => `
                    <tr>
                      <td><strong>${al.nome}</strong></td>
                      <td>${al.cpf}</td>
                      <td class="text-center">${al.presencas} / ${al.totalAulas}</td>
                      <td class="text-center">${al.faltas}</td>
                      <td class="text-right">
                        <span class="badge-pct warning">${al.pct}%</span>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : ""}
        `}
      </div>
    `).join("")}

    <div class="footer-signature">
      <div class="signature-line">Coordenação Pedagógica</div>
      <div class="signature-line">Direção Escolar</div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e: any) {
    res.status(500).send(`<h1>Erro no servidor</h1><p>${e.message}</p>`);
  }
});

/* ─── GET /diario/turmas ─── */
router.get("/diario/turmas", requireAuth, async (req, res) => {
  try {
    const turmas = await db.select().from(turmasTable).orderBy(turmasTable.nomeTurma);
    const alunosCounts = await db
      .select({ turmaAtual: alunosTable.turmaAtual, total: sql<number>`count(*)::int` })
      .from(alunosTable)
      .where(eq(alunosTable.situacao, "Matriculado"))
      .groupBy(alunosTable.turmaAtual);

    const countMap: Record<string, number> = {};
    for (const r of alunosCounts) {
      if (r.turmaAtual) countMap[r.turmaAtual] = r.total;
    }

    const profs = await db.select().from(professoresTable);
    const profsMap: Record<string, string> = {};
    for (const p of profs) {
      if (p.turmaManha) profsMap[p.turmaManha] = profsMap[p.turmaManha] ? profsMap[p.turmaManha] + ", " + p.nome : p.nome;
      if (p.turmaTarde) profsMap[p.turmaTarde] = profsMap[p.turmaTarde] ? profsMap[p.turmaTarde] + ", " + p.nome : p.nome;
    }

    const result = turmas.map((t) => ({
      ...t,
      professorResponsavel: profsMap[t.nomeTurma] || t.professorResponsavel,
      totalAlunos: countMap[t.nomeTurma] ?? 0,
    })).filter(t => t.totalAlunos > 0);

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/configuracoes ─── */
router.get("/diario/configuracoes", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(diarioConfiguracoesTable);
    const cfg: Record<string, string> = {};
    for (const r of rows) cfg[r.chave] = r.valor;
    res.json(cfg);
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── PUT /diario/configuracoes ─── */
router.put("/diario/configuracoes", requireAuth, async (req, res) => {
  try {
    const { chave, valor } = req.body;
    if (!chave || valor === undefined) return res.status(400).json({ ok: false, mensagem: "chave e valor são obrigatórios" });
    await db
      .insert(diarioConfiguracoesTable)
      .values({ chave, valor: String(valor) })
      .onConflictDoUpdate({
        target: [diarioConfiguracoesTable.chave],
        set: { valor: String(valor) },
      });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/:turma/mes/:ano/:mes ─── */
router.get("/diario/:turma/mes/:ano/:mes", requireAuth, async (req, res) => {
  try {
    const { turma, ano, mes } = req.params;
    const mesFormatado = mes.padStart(2, "0");
    const pattern = `__/${mesFormatado}/${ano}`;

    // Busca alunos: ativos + transferidos externos na turma + vindos de outra turma para esta
    const alunos = await db
      .select({
        id: alunosTable.id,
        nomeCompleto: alunosTable.nomeCompleto,
        situacao: alunosTable.situacao,
        tipoTransferencia: alunosTable.tipoTransferencia,
        dataTransferencia: alunosTable.dataTransferencia,
        turmaDestino: alunosTable.turmaDestino,
        turmaOrigem: alunosTable.turmaOrigem,
        nivelEnsino: alunosTable.nivelEnsino,
        turmaAtual: alunosTable.turmaAtual,
      })
      .from(alunosTable)
      .where(
        or(
          and(
            eq(alunosTable.turmaAtual, turma),
            sql`${alunosTable.situacao} IN ('Matriculado', 'Transferido Externo')`
          ),
          and(
            eq(alunosTable.turmaOrigem, turma),
            eq(alunosTable.tipoTransferencia, "Turma")
          )
        )
      )
      .orderBy(alunosTable.nomeCompleto);

    const aulas = await db
      .select()
      .from(diarioAulasTable)
      .where(and(
        eq(diarioAulasTable.turmaNome, turma),
        sql`${diarioAulasTable.data} LIKE ${pattern}`
      ))
      .orderBy(diarioAulasTable.data);

    if (aulas.length === 0) {
      return res.json({ alunos, aulas: [], presencas: {} });
    }

    const aulaIds = aulas.map((a) => a.id);
    const presencasRows = await db
      .select()
      .from(diarioPresencasTable)
      .where(inArray(diarioPresencasTable.aulaId, aulaIds));

    const presencas: Record<number, Record<number, string>> = {};
    for (const p of presencasRows) {
      if (!presencas[p.aulaId]) presencas[p.aulaId] = {};
      presencas[p.aulaId][p.alunoId] = p.status;
    }

    res.json({ alunos, aulas, presencas });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/frequencia-stats — percentual por turma e ranking alunos ─── */
router.get("/diario/frequencia-stats", requireAuth, async (req, res) => {
  try {
    const hoje = new Date();
    const hojeStr = `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`;
    function parseDate(s: string) { const [d,m,y] = s.split("/").map(Number); return new Date(y,m-1,d); }
    function dateLE(a: string, b: string) { return parseDate(a).getTime() <= parseDate(b).getTime(); }

    const aulas = await db.select().from(diarioAulasTable).orderBy(diarioAulasTable.data);
    const presencas = await db.select().from(diarioPresencasTable);
    const alunos = await db.select().from(alunosTable).where(eq(alunosTable.situacao, "Matriculado"));

    const presMap: Record<number, Record<number, string>> = {};
    for (const p of presencas) {
      if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
      presMap[p.aulaId][p.alunoId] = p.status;
    }
    const aulasPassadas = aulas.filter(a => dateLE(a.data, hojeStr));

    // Stats por turma
    const turmaNomes = [...new Set(aulas.map(a => a.turmaNome))];
    const statsTurma: Record<string, { total: number; presencas: number }> = {};
    for (const t of turmaNomes) {
      const aulasT = aulasPassadas.filter(a => a.turmaNome === t);
      const alunosT = alunos.filter(a => a.turmaAtual === t);
      let totalSlots = 0, totalPres = 0;
      for (const aula of aulasT) {
        for (const al of alunosT) {
          totalSlots++;
          if ((presMap[aula.id]?.[al.id] ?? "P") === "P") totalPres++;
        }
      }
      statsTurma[t] = { total: totalSlots, presencas: totalPres };
    }
    const turmasStats = Object.entries(statsTurma).map(([turma, s]) => ({
      turma,
      totalAulas: aulasPassadas.filter(a => a.turmaNome === turma).length,
      totalSlots: s.total,
      totalPresencas: s.presencas,
      pct: s.total > 0 ? Math.round((s.presencas / s.total) * 100) : null,
    }));

    // Stats por aluno
    const statsAluno: { alunoId: number; nome: string; turma: string; total: number; pres: number }[] = [];
    for (const aluno of alunos) {
      if (!aluno.turmaAtual) continue;
      const aulasAluno = aulasPassadas.filter(a => a.turmaNome === aluno.turmaAtual);
      if (!aulasAluno.length) continue;
      let pres = 0;
      for (const a of aulasAluno) {
        if ((presMap[a.id]?.[aluno.id] ?? "P") === "P") pres++;
      }
      statsAluno.push({ alunoId: aluno.id, nome: aluno.nomeCompleto, turma: aluno.turmaAtual!, total: aulasAluno.length, pres });
    }
    const comPct = statsAluno
      .filter(a => a.total > 0)
      .map(a => ({ ...a, pct: Math.round((a.pres / a.total) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    res.json({
      turmas: turmasStats,
      topAlunos: comPct.slice(0, 3),
      bottomAlunos: [...comPct].reverse().slice(0, 3),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/ficai — alunos com alerta FICAI (todas as turmas) ─── */
router.get("/diario/ficai", requireAuth, async (req, res) => {
  try {
    // Buscar configurações
    const cfgRows = await db.select().from(diarioConfiguracoesTable);
    const cfgMap: Record<string, string> = {};
    for (const r of cfgRows) cfgMap[r.chave] = r.valor;
    const thresholdConsec  = Number(cfgMap["ficai_faltas_consecutivas"] ?? 3);
    const thresholdMensais = Number(cfgMap["ficai_faltas_mensais"]      ?? 5);

    const hoje = new Date();
    const hojeStr = `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`;
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    function parseDate(s: string) {
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d);
    }
    function dateLE(a: string, b: string) {
      return parseDate(a).getTime() <= parseDate(b).getTime();
    }
    function ehMesAtual(s: string) {
      const [, m, y] = s.split("/").map(Number);
      return m === mesAtual && y === anoAtual;
    }

    const aulas    = await db.select().from(diarioAulasTable).orderBy(diarioAulasTable.data);
    const presencas = await db.select().from(diarioPresencasTable);
    const alunos   = await db.select().from(alunosTable)
      .where(eq(alunosTable.situacao, "Matriculado"));

    const presMap: Record<number, Record<number, string>> = {};
    for (const p of presencas) {
      if (!presMap[p.aulaId]) presMap[p.aulaId] = {};
      presMap[p.aulaId][p.alunoId] = p.status;
    }

    const aulasPassadas = aulas.filter(a => dateLE(a.data, hojeStr));

    type AlertaFicai = {
      alunoId: number; nome: string; turma: string;
      maxConsecutivo: number; faltasMensais: number;
      motivos: string[];
    };
    const alertas: AlertaFicai[] = [];

    for (const aluno of alunos) {
      if (!aluno.turmaAtual) continue;
      const aulasAluno = aulasPassadas
        .filter(a => a.turmaNome === aluno.turmaAtual)
        .sort((a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime());
      if (!aulasAluno.length) continue;

      // ── 1) Faltas consecutivas (qualquer sequência de dias letivos) ──
      let maxConsec = 0, currentConsec = 0;
      for (const aula of aulasAluno) {
        const status = presMap[aula.id]?.[aluno.id] ?? "P";
        if (status === "F") {
          currentConsec++;
          if (currentConsec > maxConsec) maxConsec = currentConsec;
        } else {
          currentConsec = 0;
        }
      }

      // ── 2) Total de faltas no mês atual ──
      const faltasMensais = aulasAluno
        .filter(a => ehMesAtual(a.data) && (presMap[a.id]?.[aluno.id] ?? "P") === "F")
        .length;

      const motivos: string[] = [];
      if (maxConsec  >= thresholdConsec)  motivos.push(`${maxConsec} dias consecutivos`);
      if (faltasMensais >= thresholdMensais) motivos.push(`${faltasMensais} faltas no mês`);

      if (motivos.length > 0) {
        alertas.push({
          alunoId: aluno.id,
          nome: aluno.nomeCompleto,
          turma: aluno.turmaAtual!,
          maxConsecutivo: maxConsec,
          faltasMensais,
          motivos,
        });
      }
    }

    alertas.sort((a, b) => b.maxConsecutivo - a.maxConsecutivo || b.faltasMensais - a.faltasMensais);
    res.json({ thresholdConsec, thresholdMensais, alertas });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── PUT /diario/aula/:id — atualizar conteúdo e número de aulas ─── */
router.put("/diario/aula/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { conteudo, numeroAulas } = req.body;
    if (!id) return res.status(400).json({ ok: false, mensagem: "ID inválido" });

    await db
      .update(diarioAulasTable)
      .set({
        ...(conteudo !== undefined ? { conteudo } : {}),
        ...(numeroAulas !== undefined ? { numeroAulas: Number(numeroAulas) } : {}),
      })
      .where(eq(diarioAulasTable.id, id));

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/:turma/atividades — todas as aulas com conteúdo ─── */
router.get("/diario/:turma/atividades", requireAuth, async (req, res) => {
  try {
    const { turma } = req.params;
    const aulas = await db
      .select()
      .from(diarioAulasTable)
      .where(eq(diarioAulasTable.turmaNome, turma))
      .orderBy(diarioAulasTable.data);
    res.json(aulas);
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── POST /diario/aula ─── */
router.post("/diario/aula", requireAuth, async (req, res) => {
  try {
    const { turmaNome, data } = req.body;
    if (!turmaNome || !data) return res.status(400).json({ ok: false, mensagem: "turmaNome e data são obrigatórios" });

    const [aula] = await db
      .insert(diarioAulasTable)
      .values({ turmaNome, data })
      .onConflictDoNothing()
      .returning();

    if (!aula) {
      const existente = await db
        .select()
        .from(diarioAulasTable)
        .where(and(eq(diarioAulasTable.turmaNome, turmaNome), eq(diarioAulasTable.data, data)))
        .limit(1);
      return res.json({ ok: true, aula: existente[0], jaExistia: true });
    }

    // Adiciona presença P para todos os alunos ativos da turma (e os que vieram de outra turma)
    const alunos = await db
      .select({ id: alunosTable.id })
      .from(alunosTable)
      .where(
        or(
          and(
            eq(alunosTable.turmaAtual, turmaNome),
            sql`${alunosTable.situacao} IN ('Matriculado', 'Transferido Externo')`
          ),
          and(
            eq(alunosTable.turmaOrigem, turmaNome),
            eq(alunosTable.tipoTransferencia, "Turma")
          )
        )
      );

    if (alunos.length > 0) {
      await db.insert(diarioPresencasTable).values(
        alunos.map((a) => ({ aulaId: aula.id, alunoId: a.id, status: "P" }))
      ).onConflictDoNothing();
    }

    res.json({ ok: true, aula });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── DELETE /diario/aula/:id ─── */
router.delete("/diario/aula/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(diarioAulasTable).where(eq(diarioAulasTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── PUT /diario/presenca ─── */
router.put("/diario/presenca", requireAuth, async (req, res) => {
  try {
    const { aulaId, alunoId, status } = req.body;
    if (!aulaId || !alunoId || !["P", "F"].includes(status)) {
      return res.status(400).json({ ok: false, mensagem: "aulaId, alunoId e status (P|F) são obrigatórios" });
    }

    await db
      .insert(diarioPresencasTable)
      .values({ aulaId, alunoId, status })
      .onConflictDoUpdate({
        target: [diarioPresencasTable.aulaId, diarioPresencasTable.alunoId],
        set: { status },
      });

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── POST /diario/transferir ─── */
router.post("/diario/transferir", requireAuth, async (req, res) => {
  try {
    const { alunoId, tipo, turmaDestino, dataTransferencia } = req.body;
    if (!alunoId || !tipo || !dataTransferencia) {
      return res.status(400).json({ ok: false, mensagem: "alunoId, tipo e dataTransferencia são obrigatórios" });
    }

    const [aluno] = await db.select().from(alunosTable).where(eq(alunosTable.id, alunoId)).limit(1);
    if (!aluno) return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado" });

    if (tipo === "Externa") {
      // Transferência externa: aluno permanece na turma atual mas fica marcado
      await db
        .update(alunosTable)
        .set({
          situacao: "Transferido Externo",
          tipoTransferencia: "Externa",
          dataTransferencia,
          turmaDestino: null,
        })
        .where(eq(alunosTable.id, alunoId));

    } else if (tipo === "Turma" && turmaDestino) {
      const turmaOrigem = aluno.turmaAtual!;

      // Busca aulas da turma destino para copiar presenças nas datas correspondentes
      const aulasOrigem = await db
        .select()
        .from(diarioAulasTable)
        .where(eq(diarioAulasTable.turmaNome, turmaOrigem));

      const aulasDestino = await db
        .select()
        .from(diarioAulasTable)
        .where(eq(diarioAulasTable.turmaNome, turmaDestino));

      // Mapa de data → aula na turma destino
      const destinoMap: Record<string, typeof aulasDestino[0]> = {};
      for (const a of aulasDestino) destinoMap[a.data] = a;

      // Busca presenças do aluno na turma origem
      const aulaIdsOrigem = aulasOrigem.map((a) => a.id);
      const presencasAluno = aulaIdsOrigem.length > 0
        ? await db
          .select()
          .from(diarioPresencasTable)
          .where(and(
            inArray(diarioPresencasTable.aulaId, aulaIdsOrigem),
            eq(diarioPresencasTable.alunoId, alunoId)
          ))
        : [];

      const origemPresMap: Record<number, string> = {};
      for (const p of presencasAluno) origemPresMap[p.aulaId] = p.status;

      // Copia presenças para aulas da turma destino nas mesmas datas
      const novasPresencas: { aulaId: number; alunoId: number; status: string }[] = [];
      for (const ao of aulasOrigem) {
        const ad = destinoMap[ao.data];
        if (ad) {
          novasPresencas.push({ aulaId: ad.id, alunoId, status: origemPresMap[ao.id] ?? "P" });
        }
      }

      if (novasPresencas.length > 0) {
        await db
          .insert(diarioPresencasTable)
          .values(novasPresencas)
          .onConflictDoUpdate({
            target: [diarioPresencasTable.aulaId, diarioPresencasTable.alunoId],
            set: { status: sql`excluded.status` },
          });
      }

      // Adiciona o aluno a aulas futuras da turma destino que ainda não existem como presença
      const aulasDestNoPresenca = aulasDestino.filter(
        (ad) => !novasPresencas.some((np) => np.aulaId === ad.id)
      );
      if (aulasDestNoPresenca.length > 0) {
        await db
          .insert(diarioPresencasTable)
          .values(aulasDestNoPresenca.map((a) => ({ aulaId: a.id, alunoId, status: "P" })))
          .onConflictDoNothing();
      }

      // Atualiza o aluno
      await db
        .update(alunosTable)
        .set({
          turmaAtual: turmaDestino,
          turmaOrigem: turmaOrigem,
          tipoTransferencia: "Turma",
          turmaDestino: turmaDestino,
          dataTransferencia,
          situacao: "Matriculado",
        })
        .where(eq(alunosTable.id, alunoId));

    } else {
      return res.status(400).json({ ok: false, mensagem: "Para tipo=Turma, turmaDestino é obrigatório" });
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── DELETE /diario/cancelar-transferencia/:id ─── */
router.delete("/diario/cancelar-transferencia/:id", requireAuth, async (req, res) => {
  try {
    const alunoId = Number(req.params.id);
    if (!alunoId) return res.status(400).json({ ok: false, mensagem: "ID inválido" });

    const [aluno] = await db.select().from(alunosTable).where(eq(alunosTable.id, alunoId)).limit(1);
    if (!aluno) return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado" });

    // Restaura turmaAtual para turmaOrigem se era transferência entre turmas
    const turmaRestaurada = aluno.tipoTransferencia === "Turma" && aluno.turmaOrigem
      ? aluno.turmaOrigem
      : aluno.turmaAtual;

    await db
      .update(alunosTable)
      .set({
        situacao: "Matriculado",
        tipoTransferencia: null,
        turmaDestino: null,
        turmaOrigem: null,
        dataTransferencia: null,
        turmaAtual: turmaRestaurada,
      })
      .where(eq(alunosTable.id, alunoId));

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ─── GET /diario/aluno/:id/frequencia ─── */
// Retorna frequência do diário agrupada por bimestre e mês
router.get("/diario/aluno/:id/frequencia", requireAuth, async (req, res) => {
  try {
    const alunoId = Number(req.params.id);
    if (!alunoId) return res.status(400).json({ ok: false, mensagem: "ID inválido" });

    // Busca aluno para saber turma e turma de origem
    const [aluno] = await db
      .select({ turmaAtual: alunosTable.turmaAtual, turmaOrigem: alunosTable.turmaOrigem })
      .from(alunosTable)
      .where(eq(alunosTable.id, alunoId))
      .limit(1);

    if (!aluno) return res.status(404).json({ ok: false, mensagem: "Aluno não encontrado" });

    const turmas: string[] = [];
    if (aluno.turmaAtual) turmas.push(aluno.turmaAtual);
    if (aluno.turmaOrigem && aluno.turmaOrigem !== aluno.turmaAtual) turmas.push(aluno.turmaOrigem);

    if (turmas.length === 0) return res.json({ bimestres: {}, total: { aulas: 0, presencas: 0, faltas: 0, pct: null } });

    // Busca todas as aulas das turmas do aluno
    const aulas = await db
      .select()
      .from(diarioAulasTable)
      .where(inArray(diarioAulasTable.turmaNome, turmas));

    if (aulas.length === 0) {
      return res.json({ bimestres: {}, total: { aulas: 0, presencas: 0, faltas: 0, pct: null }, meses: {} });
    }

    const aulaIds = aulas.map((a) => a.id);
    const presencasRows = await db
      .select()
      .from(diarioPresencasTable)
      .where(and(
        inArray(diarioPresencasTable.aulaId, aulaIds),
        eq(diarioPresencasTable.alunoId, alunoId)
      ));

    const presMap: Record<number, string> = {};
    for (const p of presencasRows) presMap[p.aulaId] = p.status;

    // Mapeamento mês → bimestre
    const mesBimestre: Record<number, number> = {
      2: 1, 3: 1,
      4: 2, 5: 2, 6: 2,
      8: 3, 9: 3,
      10: 4, 11: 4,
    };

    const MESES_PT: Record<number, string> = {
      1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
      7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez",
    };

    // Agrupa por bimestre e por mês
    type MesInfo = { mes: number; nomeMes: string; aulas: number; presencas: number; faltas: number; pct: number | null };
    type BimestreInfo = { bimestre: number; aulas: number; presencas: number; faltas: number; pct: number | null; meses: MesInfo[] };

    const bimestresMap: Record<number, { aulas: number; presencas: number; meses: Record<number, { aulas: number; presencas: number }> }> = {};
    let totalAulas = 0;
    let totalPresencas = 0;

    for (const aula of aulas) {
      // data = DD/MM/YYYY
      const partes = aula.data.split("/");
      const mes = parseInt(partes[1], 10);
      const bim = mesBimestre[mes] ?? 0;
      if (bim === 0) continue; // Pula meses fora do calendário (Jul, Dez, Jan)

      if (!bimestresMap[bim]) bimestresMap[bim] = { aulas: 0, presencas: 0, meses: {} };
      if (!bimestresMap[bim].meses[mes]) bimestresMap[bim].meses[mes] = { aulas: 0, presencas: 0 };

      const isPresente = (presMap[aula.id] ?? "P") === "P";
      bimestresMap[bim].aulas++;
      bimestresMap[bim].meses[mes].aulas++;
      totalAulas++;

      if (isPresente) {
        bimestresMap[bim].presencas++;
        bimestresMap[bim].meses[mes].presencas++;
        totalPresencas++;
      }
    }

    const bimestres: Record<number, BimestreInfo> = {};
    for (const [bimStr, info] of Object.entries(bimestresMap)) {
      const bim = Number(bimStr);
      const faltas = info.aulas - info.presencas;
      const pct = info.aulas > 0 ? Math.round((info.presencas / info.aulas) * 100) : null;

      const meses: MesInfo[] = Object.entries(info.meses)
        .map(([mesStr, m]) => {
          const mes = Number(mesStr);
          const mFaltas = m.aulas - m.presencas;
          const mPct = m.aulas > 0 ? Math.round((m.presencas / m.aulas) * 100) : null;
          return { mes, nomeMes: MESES_PT[mes] ?? String(mes), aulas: m.aulas, presencas: m.presencas, faltas: mFaltas, pct: mPct };
        })
        .sort((a, b) => a.mes - b.mes);

      bimestres[bim] = { bimestre: bim, aulas: info.aulas, presencas: info.presencas, faltas, pct, meses };
    }

    const totalFaltas = totalAulas - totalPresencas;
    const totalPct = totalAulas > 0 ? Math.round((totalPresencas / totalAulas) * 100) : null;

    res.json({
      bimestres,
      total: { aulas: totalAulas, presencas: totalPresencas, faltas: totalFaltas, pct: totalPct },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   POST /diario/sincronizar-pdf
   Recebe o TEXTO extraído do PDF do diário do SUAP (pela extensão Chrome),
   extrai aulas e presenças, e salva no banco. Retorna estatísticas.
═══════════════════════════════════════════════════════════════════════ */
router.post("/diario/sincronizar-pdf", requireAuth, async (req, res) => {
  try {
    const { textoPDF, turmaNome: turmaNomeHint } = req.body;
    if (!textoPDF) {
      return res.status(400).json({ ok: false, mensagem: "textoPDF é obrigatório" });
    }

    // ── Parsear o texto com o novo parser (suporte a - e 1) ──────────
    const textoStr = textoPDF as string;

    // Log diagnóstico: primeiras 400 chars e hint
    console.log("[sincronizar-pdf] turmaNomeHint:", turmaNomeHint ?? "(nenhum)");
    console.log("[sincronizar-pdf] textoPDF[:400]:", textoStr.slice(0, 400).replace(/\n/g, "↵"));

    const { secoes, erros: errosParse } = parseDiarioTexto(textoStr);

    if (secoes.length === 0) {
      // Parser não reconheceu nada — retornar diagnóstico completo
      console.log("[sincronizar-pdf] ZERO seções. Erros:", errosParse);
      console.log("[sincronizar-pdf] textoPDF[linhas 0-10]:", textoStr.split("\n").slice(0, 10).join(" | "));
      return res.status(422).json({
        ok: false,
        mensagem: "Nenhuma seção reconhecida no texto do PDF. Verifique se é um diário SUAP válido.",
        detalhes: errosParse,
        diagnostico: textoStr.split("\n").slice(0, 20),
      });
    }

    // ── Processar cada seção ─────────────────────────────────────────
    let totalAulas = 0;
    let totalPresencas = 0;
    let totalAlunosNaoEncontrados = 0;
    const turmasProcessadas: string[] = [];

    for (const secao of secoes) {
      // Turma: usar o hint da extensão (ex: "1AM01") ou o código bruto do PDF
      const turmaNome = turmaNomeHint?.trim() || secao.turmaCodigo;
      if (!turmaNome) continue;

      // ── Buscar alunos da turma ──────────────────────────────────
      const alunos = await db
        .select({ id: alunosTable.id, nomeCompleto: alunosTable.nomeCompleto, matricula: alunosTable.matricula })
        .from(alunosTable)
        .where(
          or(
            and(
              eq(alunosTable.turmaAtual, turmaNome),
              sql`${alunosTable.situacao} IN ('Matriculado', 'Transferido Externo')`
            ),
            and(
              eq(alunosTable.turmaOrigem, turmaNome),
              eq(alunosTable.tipoTransferencia, "Turma")
            )
          )
        );

      if (alunos.length === 0) continue;

      // Índices de busca: por matrícula e por nome normalizado
      const porMatricula = new Map<string, number>();
      const porNome = new Map<string, number>();
      for (const a of alunos) {
        if (a.matricula) porMatricula.set(a.matricula, a.id);
        porNome.set(normNomeBusca(a.nomeCompleto), a.id);
      }

      // ── Construir mapa de presenças por data → alunoId → status ──
      const presencasPorData: Record<string, Record<number, "P" | "F">> = {};
      const datasSet = new Set<string>();

      for (const alunoFreq of secao.alunos) {
        // Tentar match por matrícula primeiro, depois por nome
        let alunoId: number | undefined = porMatricula.get(alunoFreq.matricula);
        if (!alunoId) alunoId = porNome.get(normNomeBusca(alunoFreq.nome));
        if (!alunoId) { totalAlunosNaoEncontrados++; continue; }

        for (const freq of alunoFreq.frequencias) {
          // Converter YYYY-MM-DD → DD/MM/YYYY (formato do banco)
          const dataDB = isoParaDDMMAAAA(freq.data);
          datasSet.add(dataDB);
          if (!presencasPorData[dataDB]) presencasPorData[dataDB] = {};
          presencasPorData[dataDB][alunoId] = freq.status;
        }
      }

      if (datasSet.size === 0) continue;

      // Mesclar datas das atividades (algumas datas podem ter conteúdo mas não aparecer nas presenças)
      for (const atv of secao.atividades) {
        datasSet.add(isoParaDDMMAAAA(atv.data));
      }

      const datasOrdenadas = [...datasSet].sort((a, b) => {
        const [da, ma, ya] = a.split("/").map(Number);
        const [db2, mb, yb] = b.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db2).getTime();
      });

      // ── Construir mapa de conteúdo por data ──────────────────────
      const conteudoPorData: Record<string, string> = {};
      for (const atv of secao.atividades) {
        conteudoPorData[isoParaDDMMAAAA(atv.data)] = atv.conteudo;
      }

      // ── Upsert de aulas e presenças ───────────────────────────────
      for (const dataDB of datasOrdenadas) {
        const conteudo = conteudoPorData[dataDB] ?? null;

        const [aulaRow] = await db
          .insert(diarioAulasTable)
          .values({ turmaNome, data: dataDB, numeroAulas: 1, conteudo })
          .onConflictDoUpdate({
            target: [diarioAulasTable.turmaNome, diarioAulasTable.data],
            set: { conteudo: sql`COALESCE(excluded.conteudo, diario_aulas.conteudo)` },
          })
          .returning({ id: diarioAulasTable.id });

        const aulaId = aulaRow.id;
        totalAulas++;

        const presAula = presencasPorData[dataDB] ?? {};
        const rows: { aulaId: number; alunoId: number; status: string }[] = [];

        for (const aluno of alunos) {
          const status = presAula[aluno.id] ?? "P";
          rows.push({ aulaId, alunoId: aluno.id, status });
        }

        if (rows.length > 0) {
          await db
            .insert(diarioPresencasTable)
            .values(rows)
            .onConflictDoUpdate({
              target: [diarioPresencasTable.aulaId, diarioPresencasTable.alunoId],
              set: { status: sql`excluded.status` },
            });
          totalPresencas += rows.length;
        }
      }

      turmasProcessadas.push(turmaNome);
    }

    if (turmasProcessadas.length === 0) {
      return res.status(422).json({
        ok: false,
        mensagem: "Nenhuma turma pôde ser processada. Verifique se os alunos estão cadastrados com os mesmos códigos de turma.",
        secoesEncontradas: secoes.map(s => ({ turmaCodigo: s.turmaCodigo, turmaLocal: s.turmaLocal })),
        errosParse,
      });
    }

    res.json({
      ok: true,
      turmas: turmasProcessadas,
      totalAulas,
      totalPresencas,
      totalAlunosNaoEncontrados,
      errosParse,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, mensagem: e.message });
  }
});

function isoParaDDMMAAAA(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function normNomeBusca(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default router;

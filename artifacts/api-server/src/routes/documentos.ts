// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../../lib/db/src/index.ts";
import { alunosTable, turmasTable, funcionariosTable, diarioAulasTable } from "../../lib/db/src/index.ts/schema";
import { eq, and, asc, not, ilike } from "drizzle-orm";
import { isDiaLetivo } from "../lib/calendario2026";

const router: IRouter = Router();

const TIPOS_DOCUMENTO = [
  { id: "matricula", titulo: "Declaração de Matrícula", descricao: "Declara que o aluno está matriculado na escola" },
  { id: "frequencia", titulo: "Declaração de Frequência", descricao: "Declara frequência do aluno no período letivo" },
  { id: "transferencia", titulo: "Declaração de Transferência", descricao: "Declaração para fins de transferência" },
  { id: "conclusao", titulo: "Declaração de Conclusão", descricao: "Declara a conclusão do período/ano letivo" },
  { id: "vaga", titulo: "Declaração de Vaga", descricao: "Declara a existência de vaga para o aluno" },
];

router.get("/documentos/tipos", (_req, res) => {
  res.json(TIPOS_DOCUMENTO);
});

router.post("/documentos/gerar", async (req, res) => {
  const { tipoDocumento, alunoId, observacoes } = req.body;

  if (!tipoDocumento || !alunoId) {
    res.status(400).json({ erro: "campos_obrigatorios", mensagem: "Tipo de documento e aluno são obrigatórios" });
    return;
  }

  const tipo = TIPOS_DOCUMENTO.find(t => t.id === tipoDocumento);
  if (!tipo) { res.status(400).json({ erro: "tipo_invalido", mensagem: "Tipo de documento inválido" }); return; }

  const alunos = await db.select().from(alunosTable).where(eq(alunosTable.id, Number(alunoId)));
  if (!alunos[0]) { res.status(404).json({ erro: "aluno_nao_encontrado", mensagem: "Aluno não encontrado" }); return; }

  const aluno = alunos[0];
  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  let textoDeclaracao = "";

  if (tipoDocumento === "matricula") {
    textoDeclaracao = `
DECLARAÇÃO DE MATRÍCULA

Declaramos para os devidos fins que ${aluno.nomeCompleto}, portador(a) do CPF ${aluno.cpf || "___________"},
nasceu em ${aluno.naturalidade || "___________"}, em ${aluno.dataNascimento || "___________"}, filho(a) de ${aluno.nomeMae || "___________"},
encontra-se devidamente MATRICULADO(A) nesta instituição de ensino, na turma ${aluno.turmaAtual || "___________"},
turno ${aluno.turno || "___________"}, no ano letivo de ${new Date().getFullYear()}.

${observacoes ? `\nObservações: ${observacoes}` : ""}

Campos dos Goytacazes, ${dataAtual}.

_________________________________
E. M. José Giró Faísca
Diretora/Coordenação Pedagógica
    `.trim();
  } else if (tipoDocumento === "frequencia") {
    textoDeclaracao = `
DECLARAÇÃO DE FREQUÊNCIA

Declaramos para os devidos fins que ${aluno.nomeCompleto}, matriculado(a) sob o nº ${aluno.matricula || "___________"},
na turma ${aluno.turmaAtual || "___________"}, turno ${aluno.turno || "___________"},
vem frequentando regularmente as aulas nesta instituição de ensino no ano letivo de ${new Date().getFullYear()}.

${observacoes ? `\nObservações: ${observacoes}` : ""}

Campos dos Goytacazes, ${dataAtual}.

_________________________________
E. M. José Giró Faísca
Diretora/Coordenação Pedagógica
    `.trim();
  } else if (tipoDocumento === "transferencia") {
    textoDeclaracao = `
DECLARAÇÃO DE TRANSFERÊNCIA

Declaramos para os devidos fins que ${aluno.nomeCompleto}, portador(a) do CPF ${aluno.cpf || "___________"},
esteve matriculado(a) nesta instituição de ensino, cursando o ${aluno.nivelEnsino || "Ensino Fundamental"},
na turma ${aluno.turmaAtual || "___________"}, turno ${aluno.turno || "___________"}.

Esta declaração é expedida a pedido do(a) interessado(a), para fins de TRANSFERÊNCIA.

${observacoes ? `\nObservações: ${observacoes}` : ""}

Campos dos Goytacazes, ${dataAtual}.

_________________________________
E. M. José Giró Faísca
Diretora/Coordenação Pedagógica
    `.trim();
  } else {
    textoDeclaracao = `
${tipo.titulo.toUpperCase()}

Declaramos para os devidos fins que ${aluno.nomeCompleto}, portador(a) do CPF ${aluno.cpf || "___________"},
matriculado(a) sob o nº ${aluno.matricula || "___________"}, na turma ${aluno.turmaAtual || "___________"},
turno ${aluno.turno || "___________"}.

${observacoes ? `\nObservações: ${observacoes}` : ""}

Campos dos Goytacazes, ${dataAtual}.

_________________________________
E. M. José Giró Faísca
Diretora/Coordenação Pedagógica
    `.trim();
  }

  res.json({
    conteudo: textoDeclaracao,
    nomeArquivo: `${tipo.titulo.toLowerCase().replace(/ /g, "_")}_${aluno.nomeCompleto.split(" ")[0].toLowerCase()}.txt`,
    tipo: "texto",
  });
});

router.post("/documentos/listas", async (req, res) => {
  const { tipo, turmaId, titulo } = req.body;

  if (!tipo) {
    res.status(400).json({ erro: "campos_obrigatorios", mensagem: "Tipo de lista é obrigatório" });
    return;
  }

  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  let conteudo = "";
  let nomeArquivo = "";

  if (tipo === "alunos") {
    let alunos;
    let nomeTurma = "Todas as Turmas";

    if (turmaId) {
      const turmas = await db.select().from(turmasTable).where(eq(turmasTable.id, Number(turmaId)));
      if (turmas[0]) {
        nomeTurma = turmas[0].nomeTurma;
        alunos = await db.select().from(alunosTable)
          .where(and(eq(alunosTable.turmaAtual, turmas[0].nomeTurma), eq(alunosTable.arquivoMorto, 0)))
          .orderBy(alunosTable.nomeCompleto);
      }
    } else {
      alunos = await db.select().from(alunosTable).where(eq(alunosTable.arquivoMorto, 0)).orderBy(alunosTable.nomeCompleto);
    }

    conteudo = `LISTA DE ALUNOS - ${nomeTurma}\n`;
    conteudo += `E. M. José Giró Faísca | ${dataAtual}\n`;
    conteudo += "=".repeat(60) + "\n\n";
    conteudo += `Nº | NOME | MATRÍCULA | TURMA | TURNO\n`;
    conteudo += "-".repeat(60) + "\n";
    (alunos || []).forEach((a, i) => {
      conteudo += `${i + 1}. ${a.nomeCompleto} | ${a.matricula || "-"} | ${a.turmaAtual || "-"} | ${a.turno || "-"}\n`;
    });
    conteudo += `\nTotal: ${(alunos || []).length} aluno(s)`;
    nomeArquivo = `lista_alunos_${nomeTurma.toLowerCase().replace(/ /g, "_")}.txt`;

  } else if (tipo === "funcionarios") {
    const funcionarios = await db.select().from(funcionariosTable).orderBy(funcionariosTable.nomeCompleto);
    conteudo = `LISTA DE FUNCIONÁRIOS\n`;
    conteudo += `E. M. José Giró Faísca | ${dataAtual}\n`;
    conteudo += "=".repeat(60) + "\n\n";
    conteudo += `Nº | NOME | FUNÇÃO | TURNO | VÍNCULO\n`;
    conteudo += "-".repeat(60) + "\n";
    funcionarios.forEach((f, i) => {
      conteudo += `${i + 1}. ${f.nomeCompleto} | ${f.funcao || "-"} | ${f.turno || "-"} | ${f.vinculo || "-"}\n`;
    });
    conteudo += `\nTotal: ${funcionarios.length} funcionário(s)`;
    nomeArquivo = "lista_funcionarios.txt";

  } else if (tipo === "assinatura_reuniao") {
    let alunos: any[] = [];
    let nomeTurma = "Reunião Geral";

    if (turmaId) {
      const turmas = await db.select().from(turmasTable).where(eq(turmasTable.id, Number(turmaId)));
      if (turmas[0]) {
        nomeTurma = turmas[0].nomeTurma;
        alunos = await db.select().from(alunosTable)
          .where(and(eq(alunosTable.turmaAtual, turmas[0].nomeTurma), eq(alunosTable.arquivoMorto, 0)))
          .orderBy(alunosTable.nomeCompleto);
      }
    }

    const tituloLista = titulo || `Lista de Presença - ${nomeTurma}`;
    conteudo = `${tituloLista.toUpperCase()}\n`;
    conteudo += `E. M. José Giró Faísca | ${dataAtual}\n`;
    conteudo += "=".repeat(70) + "\n\n";
    conteudo += `Nº | NOME DO ALUNO | RESPONSÁVEL | ASSINATURA\n`;
    conteudo += "-".repeat(70) + "\n";
    alunos.forEach((a, i) => {
      conteudo += `${i + 1}. ${a.nomeCompleto.padEnd(35)} | ${(a.responsavel || "-").padEnd(20)} | _________________\n`;
    });
    nomeArquivo = `lista_assinatura_${nomeTurma.toLowerCase().replace(/ /g, "_")}.txt`;
  }

  res.json({ conteudo, nomeArquivo, tipo: "texto" });
});

/* ── Pré-Diário: dados de turma + alunos + datas letivas ── */
router.get("/documentos/prediario", async (req, res) => {
  const { turma, mes, ano, feriados: feriadosParam, recessos: recessosParam } =
    req.query as Record<string, string | undefined>;

  // Dias extras a excluir (enviados pelo frontend como "d1,d2,d3")
  const diasFeriados = (feriadosParam || "").split(",").map(Number).filter(d => d > 0);
  const diasRecessos = (recessosParam  || "").split(",").map(Number).filter(d => d > 0);
  const diasExcluidos = new Set([...diasFeriados, ...diasRecessos]);

  function parseDDMMYYYY(d: string): Date {
    const [dd, mm, yyyy] = d.split("/").map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  // Gerar datas letivas para o mês selecionado (via calendário, sem SUAP)
  function gerarDatasDoMes(mesN: number, anoN: number): { data: string; aulas: number }[] {
    const total = new Date(anoN, mesN, 0).getDate(); // dias no mês (mes já é 1-indexed aqui)
    const datas: { data: string; aulas: number }[] = [];
    for (let d = 1; d <= total; d++) {
      if (diasExcluidos.has(d)) continue;
      const dd = String(d).padStart(2, "0");
      const mm = String(mesN).padStart(2, "0");
      const dataStr = `${dd}/${mm}/${anoN}`;
      if (isDiaLetivo(dataStr)) {
        datas.push({ data: dataStr, aulas: 1 });
      }
    }
    return datas;
  }

  const mesSelecionado = mes ? parseInt(mes, 10) : null;
  const anoSelecionado = ano ? parseInt(ano, 10) : null;
  const usarCalendario = !!(mesSelecionado && anoSelecionado);

  let listaTurmas;
  if (turma && turma !== "todas") {
    listaTurmas = await db.select().from(turmasTable)
      .where(eq(turmasTable.nomeTurma, turma));
  } else {
    listaTurmas = await db.select().from(turmasTable)
      .orderBy(asc(turmasTable.nomeTurma));
  }

  const resultado = [];
  for (const t of listaTurmas) {
    const alunos = await db.select()
      .from(alunosTable)
      .where(and(
        eq(alunosTable.turmaAtual, t.nomeTurma),
        eq(alunosTable.arquivoMorto, 0)
      ))
      .orderBy(asc(alunosTable.nomeCompleto));

    let datasLetivas: { data: string; aulas: number }[];

    if (usarCalendario) {
      // Gerar todos os dias letivos do mês selecionado a partir do calendário
      datasLetivas = gerarDatasDoMes(mesSelecionado!, anoSelecionado!);
    } else {
      // Comportamento legado: usar datas do SUAP (diarioAulasTable)
      const aulas = await db.select()
        .from(diarioAulasTable)
        .where(eq(diarioAulasTable.turmaNome, t.nomeTurma));

      datasLetivas = aulas
        .filter(a => isDiaLetivo(a.data))
        .sort((a, b) => parseDDMMYYYY(a.data).getTime() - parseDDMMYYYY(b.data).getTime())
        .map(a => ({ data: a.data, aulas: a.numeroAulas ?? 1 }));
    }

    resultado.push({
      turma: {
        nome: t.nomeTurma,
        turno: t.turno || "",
        professor: t.professorResponsavel || "",
      },
      alunos: alunos.map((a, i) => ({ n: i + 1, nome: a.nomeCompleto })),
      datasLetivas,
    });
  }

  res.json(resultado);
});

export default router;

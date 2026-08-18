const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("=== ADEQUANDO BANCO DE DADOS EXATAMENTE AO ANO DE 2026 (14 TURMAS) ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  if (!fs.existsSync(xlsPath)) {
    console.error("Relatorio (1).xls não encontrado!");
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map(c => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: headerRowIdx });
  const colunas = Object.keys(rows[0] || {});

  const getVal = (r, keys) => {
    for (const k of keys) {
      const found = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (found && r[found] !== undefined && r[found] !== null) return String(r[found]).trim();
    }
    return "";
  };

  const extrairSiglaTurma = (raw) => {
    if (!raw) return null;
    const m = raw.match(/\(([^)]+)\)/);
    return m ? m[1].trim() : raw.trim();
  };

  // 1. Atualizar Turmas para conter APENAS as 14 turmas oficiais
  const turmasOficiais = [
    { nomeTurma: "1AM01", turno: "Manhã" },
    { nomeTurma: "1AT02", turno: "Tarde" },
    { nomeTurma: "2AM01", turno: "Manhã" },
    { nomeTurma: "2AT02", turno: "Tarde" },
    { nomeTurma: "3AM01", turno: "Manhã" },
    { nomeTurma: "4AM01", turno: "Manhã" },
    { nomeTurma: "5AT01", turno: "Tarde" },
    { nomeTurma: "G2T01", turno: "Tarde" },
    { nomeTurma: "G3M01", turno: "Manhã" },
    { nomeTurma: "NIT01", turno: "Manhã" },
    { nomeTurma: "P1M01", turno: "Manhã" },
    { nomeTurma: "P1T02", turno: "Tarde" },
    { nomeTurma: "P2M01", turno: "Manhã" },
    { nomeTurma: "P2T02", turno: "Tarde" }
  ];

  await client.query("DELETE FROM turmas");
  for (const t of turmasOficiais) {
    await client.query("INSERT INTO turmas (nome_turma, turno, cor) VALUES ($1, $2, '#3b82f6')", [t.nomeTurma, t.turno]);
  }
  console.log("✓ Tabela 'turmas' atualizada para exatamente 14 turmas oficiais de 2026.");

  // 2. Marcar todos os alunos existentes como arquivo_morto = 1 por padrão
  await client.query("UPDATE alunos SET arquivo_morto = 1, situacao = 'Transferido' WHERE arquivo_morto = 0 OR arquivo_morto IS NULL");

  // 3. Atualizar e reativar estritamente os alunos presentes em Relatorio (1).xls
  let ativosAtualizados = 0;
  const matriculasReport = new Set();
  const nomesReport = new Set();

  for (const r of rows) {
    const nome = getVal(r, ["nome completo", "nome do aluno", "nome"]);
    const matricula = getVal(r, ["matrícula", "matricula", "mat."]);
    const rawTurma = getVal(r, ["turma", "turma/série"]);
    const siglaTurma = extrairSiglaTurma(rawTurma);
    const situacaoRaw = getVal(r, ["situação no curso", "situacao no curso", "situação", "situacao", "status"]);
    const isMatriculado = situacaoRaw.toLowerCase().includes("matriculado");
    const turno = getVal(r, ["turno"]) || (siglaTurma && siglaTurma.includes("T") ? "Tarde" : "Manhã");

    if (!nome || nome.length < 3) continue;

    if (matricula) matriculasReport.add(matricula);
    nomesReport.add(nome.toLowerCase().trim());

    // Tentar atualizar registro existente
    const resUpdate = await client.query(`
      UPDATE alunos
      SET arquivo_morto = $1,
          situacao = $2,
          turma_atual = $3,
          turno = $4,
          motivo_saida = CASE WHEN $1 = 0 THEN NULL ELSE motivo_saida END,
          data_saida = CASE WHEN $1 = 0 THEN NULL ELSE data_saida END
      WHERE (matricula IS NOT NULL AND matricula = $5 AND $5 != '')
         OR (LOWER(TRIM(nome_completo)) = LOWER(TRIM($6)))
    `, [
      isMatriculado ? 0 : 1,
      isMatriculado ? "Matriculado" : situacaoRaw,
      siglaTurma,
      turno,
      matricula,
      nome
    ]);

    if (resUpdate.rowCount > 0 && isMatriculado) {
      ativosAtualizados++;
    }
  }

  // 4. Contagem final no banco
  const resAtivos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 0 AND situacao = 'Matriculado'");
  const resMortos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 1");
  const resTurmasCount = await client.query("SELECT count(*) FROM turmas");
  const resPorTurma = await client.query(`
    SELECT turma_atual, count(*) 
    FROM alunos 
    WHERE arquivo_morto = 0 
    GROUP BY turma_atual 
    ORDER BY turma_atual
  `);

  console.log("\n=== CONTAGEM FINAL APÓS ADEQUAÇÃO 2026 ===");
  console.log(`Turmas Ativas no Banco: ${resTurmasCount.rows[0].count}`);
  console.log(`Total de Alunos MATRICULADOS no Banco: ${resAtivos.rows[0].count}`);
  console.log(`Total de Alunos Arquivados/Transferidos: ${resMortos.rows[0].count}`);
  console.log("\nAlunos Ativos por Turma (2026):", resPorTurma.rows);

  await client.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});

const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function resolverTurmaCorreta(rawTurma, turno) {
  if (!rawTurma) return null;
  const m = rawTurma.match(/\(([^)]+)\)/);
  let sigla = m ? m[1].trim() : rawTurma.trim();
  const tNorm = String(turno || '').trim().toLowerCase();

  // Mapeamento Inteligente: Corrigir classe com base no Turno real do aluno
  // 1º Ano
  if (sigla.startsWith("1A") || rawTurma.includes("1.03161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "1AM01";
    if (tNorm === "tarde") return "1AT02";
  }

  // 2º Ano
  if (sigla.startsWith("2A") || rawTurma.includes("2.03161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "2AM01";
    if (tNorm === "tarde") return "2AT02";
  }

  // 3º Ano
  if (sigla.startsWith("3A") || rawTurma.includes("3.03161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "3AM01";
    if (tNorm === "tarde") return "3AT02";
  }

  // 4º Ano
  if (sigla.startsWith("4A") || rawTurma.includes("4.03161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "4AM01";
    if (tNorm === "tarde") return "4AT01";
  }

  // 5º Ano
  if (sigla.startsWith("5A") || rawTurma.includes("5.03161")) {
    if (tNorm === "tarde") return "5AT01";
    if (tNorm === "manhã" || tNorm === "manha") return "5AM01";
  }

  // Pré 1 (P1)
  if (sigla.startsWith("P1") || rawTurma.includes("P1") || rawTurma.includes("4.02161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "P1M01";
    if (tNorm === "tarde") return "P1T02";
  }

  // Pré 2 (P2)
  if (sigla.startsWith("P2") || rawTurma.includes("P2") || rawTurma.includes("5.02161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "P2M01";
    if (tNorm === "tarde") return "P2T02";
  }

  // G2 / G3
  if (sigla.startsWith("G2") || rawTurma.includes("2.02161")) {
    if (tNorm === "tarde") return "G2T01";
  }
  if (sigla.startsWith("G3") || rawTurma.includes("3.02161")) {
    if (tNorm === "manhã" || tNorm === "manha") return "G3M01";
    if (tNorm === "tarde") return "G3T01";
  }

  return sigla;
}

async function main() {
  await client.connect();
  console.log("=== TESTANDO CORREÇÃO INTELIGENTE DE TURMA X TURNO DO SUAP ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total de alunos no relatório: ${rows.length}`);

  let realocados = 0;
  const porTurmaNova = {};

  for (const r of rows) {
    const nome = String(r['Nome'] || '').trim();
    const matricula = String(r['Matrícula'] || '').trim();
    const rawTurma = String(r['Turma Atual'] || '').trim();
    const turno = String(r['Turno'] || '').trim();
    const situacao = String(r['Situação no Curso'] || '').trim();
    const isMatriculado = situacao.toLowerCase().includes("matriculado");

    if (!nome || nome.length < 3 || !isMatriculado) continue;

    const turmaResolvida = resolverTurmaCorreta(rawTurma, turno);
    porTurmaNova[turmaResolvida] = (porTurmaNova[turmaResolvida] || 0) + 1;

    // Atualizar no banco
    const updateRes = await client.query(`
      UPDATE alunos
      SET turma_atual = $1, turno = $2, situacao = 'Matriculado', arquivo_morto = 0
      WHERE (matricula IS NOT NULL AND matricula = $3 AND $3 != '')
         OR (LOWER(TRIM(nome_completo)) = LOWER(TRIM($4)))
    `, [turmaResolvida, turno, matricula, nome]);

    if (updateRes.rowCount > 0) realocados++;
  }

  console.log(`\nTotal de alunos matriculados realocados no banco com turma/turno corretos: ${realocados}`);
  console.log("\nNova distribuição de alunos por Turma Oficial:", porTurmaNova);

  // Verificar Eloa especificamente
  const resEloa = await client.query("SELECT nome_completo, turma_atual, turno, situacao FROM alunos WHERE nome_completo ILIKE '%ELOA NETO BENTO%'");
  console.log("\nStatus da aluna ELOA NETO BENTO no banco agora:", resEloa.rows[0]);

  await client.end();
}

main().catch(console.error);

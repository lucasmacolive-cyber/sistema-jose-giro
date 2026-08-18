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
  console.log("=== ANÁLISE DETALHADA DAS TURMAS DO 1º ANO (1AM01 e 1AT02) ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  if (!fs.existsSync(xlsPath)) {
    console.error("Relatorio (1).xls não encontrado!");
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total de registros no Excel: ${rows.length}`);

  // Filtrar alunos do 1º ano no Excel
  const alunos1anoExcel = rows.filter(r => {
    const t = String(r['Turma Atual'] || '') + " " + String(r['Turma no Ano Selecionado'] || '');
    return t.includes("1AM01") || t.includes("1AT02") || t.includes("1.03161") || t.includes("1AM") || t.includes("1AT");
  });

  console.log(`\nTotal de alunos identificados como 1º Ano no Excel: ${alunos1anoExcel.length}`);

  const porTurmaExcel = {};
  alunos1anoExcel.forEach(r => {
    const t = String(r['Turma Atual'] || 'Sem Turma');
    const s = String(r['Situação no Curso'] || 'Desconhecido');
    const key = `${t} | ${s}`;
    porTurmaExcel[key] = (porTurmaExcel[key] || 0) + 1;
  });

  console.log("\nDetalhamento 1º Ano no Excel (Turma | Situação):", porTurmaExcel);

  // Listar todos os alunos do 1º ano do Excel com Nome, Matrícula, Turma Atual e Situação
  console.log("\n--- LISTA COMPLETA DOS ALUNOS DO 1º ANO NO EXCEL ---");
  alunos1anoExcel.forEach((r, i) => {
    console.log(`${i+1}. [${r['Matrícula'] || 'S/MAT'}] ${r['Nome']} - Turma: "${r['Turma Atual']}" | Situação: "${r['Situação no Curso']}" | Turno: "${r['Turno']}"`);
  });

  // Consultar alunos do 1º ano no Banco de Dados
  const resDb = await client.query(`
    SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto
    WHERE turma_atual IN ('1AM01', '1AT02') OR turma_atual ILIKE '%1AM%' OR turma_atual ILIKE '%1AT%'
    ORDER BY turma_atual, nome_completo
  `.replace("WHERE", "FROM alunos WHERE"));

  console.log(`\nTotal de alunos no Banco cadastrados no 1º Ano: ${resDb.rows.length}`);
  const porTurmaDb = {};
  resDb.rows.forEach(a => {
    const key = `${a.turma_atual} | situacao: ${a.situacao} | arq_morto: ${a.arquivo_morto}`;
    porTurmaDb[key] = (porTurmaDb[key] || 0) + 1;
  });
  console.log("Detalhamento 1º Ano no Banco:", porTurmaDb);

  // Cruzar cada aluno do Excel do 1º ano com o Banco para ver se falta alguém ou se algum está como arquivado/outra turma
  console.log("\n--- ANÁLISE DE CORRESPONDÊNCIA (EXCEL vs BANCO) ---");
  for (const r of alunos1anoExcel) {
    const mat = String(r['Matrícula'] || '').trim();
    const nome = String(r['Nome'] || '').trim();
    const rawTurma = String(r['Turma Atual'] || '').trim();
    const mSigla = rawTurma.match(/\(([^)]+)\)/);
    const siglaExcel = mSigla ? mSigla[1].trim() : rawTurma;

    const dbMatch = await client.query(`
      SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto
      FROM alunos
      WHERE (matricula IS NOT NULL AND matricula = $1 AND $1 != '')
         OR (LOWER(TRIM(nome_completo)) = LOWER(TRIM($2)))
    `, [mat, nome]);

    if (dbMatch.rows.length === 0) {
      console.log(`❌ NÃO ENCONTRADO NO BANCO: ${nome} (${mat}) - Turma Excel: ${siglaExcel}`);
    } else {
      const aluno = dbMatch.rows[0];
      const divergencias = [];
      if (aluno.turma_atual !== siglaExcel) divergencias.push(`Turma no Banco: "${aluno.turma_atual}" vs Excel: "${siglaExcel}"`);
      if (aluno.arquivo_morto !== 0 && String(r['Situação no Curso']).includes("Matriculado")) divergencias.push(`Arquivo Morto no Banco: ${aluno.arquivo_morto} (Deveria ser 0/Ativo)`);
      if (aluno.situacao !== r['Situação no Curso']) divergencias.push(`Situação Banco: "${aluno.situacao}" vs Excel: "${r['Situação no Curso']}"`);

      if (divergencias.length > 0) {
        console.log(`⚠️ DIVERGÊNCIA: ${aluno.nome_completo} -> ${divergencias.join(" | ")}`);
      } else {
        console.log(`OK: ${aluno.nome_completo} -> Turma: ${aluno.turma_atual}`);
      }
    }
  }

  await client.end();
}

main().catch(console.error);

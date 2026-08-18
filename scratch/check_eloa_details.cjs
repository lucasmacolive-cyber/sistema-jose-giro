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
  console.log("=== INSPEÇÃO DETALHADA DA ALUNA ELOA ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  const eloaRows = rows.filter(r => String(r['Nome'] || '').toUpperCase().includes("ELOA"));
  console.log(`Encontrados ${eloaRows.length} registros com 'ELOA' no Excel:`);

  eloaRows.forEach(r => {
    console.log({
      Nome: r['Nome'],
      Matricula: r['Matrícula'],
      TurmaAtual: r['Turma Atual'],
      TurmaAnoSelecionado: r['Turma no Ano Selecionado'],
      Turno: r['Turno'],
      Situacao: r['Situação no Curso']
    });
  });

  const dbEloa = await client.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto FROM alunos WHERE nome_completo ILIKE '%ELOA%'");
  console.log("\nRegistros com 'ELOA' no Banco de Dados:", dbEloa.rows);

  // Verificar todos os alunos onde a coluna Turno no Excel é Manhã mas a Turma tem 'T' (ou vice-versa)
  console.log("\n--- ALUNOS COM DIVERGÊNCIA ENTRE TURNO E TURMA NO EXCEL ---");
  rows.forEach(r => {
    const nome = r['Nome'];
    const turma = r['Turma Atual'];
    const turno = r['Turno'];
    if (turno === "Manhã" && turma && turma.includes("1T")) {
      console.log(`⚠️ Turno é MANHÃ mas a Turma no SUAP é ${turma}: ${nome}`);
    } else if (turno === "Tarde" && turma && turma.includes("1M")) {
      console.log(`⚠️ Turno é TARDE mas a Turma no SUAP é ${turma}: ${nome}`);
    }
  });

  await client.end();
}

main().catch(console.error);

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
  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log("Amostra 5 nomes do Excel:", rows.slice(0, 5).map(r => ({ Nome: r['Nome'], Matricula: r['Matrícula'], Turma: r['Turma Atual'] })));

  const dbAlunos = await client.query("SELECT id, nome_completo, matricula, turma_atual FROM alunos LIMIT 5");
  console.log("Amostra 5 nomes do Banco:", dbAlunos.rows);

  await client.end();
}

main().catch(console.error);

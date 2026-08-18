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

  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log("Linha 0 da matriz:", rawMatrix[0].slice(0, 10));
  console.log("Linha 1 da matriz:", rawMatrix[1].slice(0, 10));
  console.log("Linha 2 da matriz:", rawMatrix[2].slice(0, 10));

  // Testar busca de AKILLA no banco
  const dbAkilla = await client.query("SELECT id, matricula, nome_completo, turma_atual, situacao, arquivo_morto FROM alunos WHERE nome_completo ILIKE '%AKILLA%'");
  console.log("\nAkilla no Banco:", dbAkilla.rows);

  await client.end();
}

main().catch(console.error);

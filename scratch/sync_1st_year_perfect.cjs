const { Client } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function extrairSiglaTurma(raw) {
  if (!raw) return null;
  const m = raw.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : raw.trim();
}

async function main() {
  await client.connect();
  console.log("=== ADEQUANDO ALUNOS DO 1º ANO (1AM01 E 1AT02) PARA CORRESPONDÊNCIA DE 100% ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // Filtrar alunos do 1º ano
  const alunos1Ano = rows.filter(r => {
    const t = String(r['Turma Atual'] || '') + " " + String(r['Turma no Ano Selecionado'] || '');
    return t.includes("1AM01") || t.includes("1AT02") || t.includes("1.03161.1M") || t.includes("1.03161.1T");
  });

  console.log(`Encontrados ${alunos1Ano.length} alunos do 1º ano no relatório SUAP.`);

  for (const r of alunos1Ano) {
    const nome = String(r['Nome'] || '').trim();
    const matricula = String(r['Matrícula'] || '').trim();
    const rawTurma = String(r['Turma Atual'] || '').trim();
    const siglaTurma = extrairSiglaTurma(rawTurma);
    const situacaoRaw = String(r['Situação no Curso'] || 'Matriculado').trim();
    const isMatriculado = situacaoRaw.toLowerCase().includes("matriculado");
    const turno = String(r['Turno'] || '').trim() || (siglaTurma && siglaTurma.includes("T") ? "Tarde" : "Manhã");
    const cpf = String(r['CPF'] || '').trim() || null;

    if (!nome || nome.length < 3) continue;

    const arquivoMorto = isMatriculado ? 0 : 1;
    const situacaoFinal = isMatriculado ? "Matriculado" : situacaoRaw;

    // Atualizar no banco
    const res = await client.query(`
      UPDATE alunos
      SET turma_atual = $1,
          turno = $2,
          situacao = $3,
          arquivo_morto = $4,
          cpf = COALESCE($5, cpf),
          motivo_saida = CASE WHEN $4 = 0 THEN NULL ELSE motivo_saida END
      WHERE (matricula IS NOT NULL AND matricula = $6 AND $6 != '')
         OR (LOWER(TRIM(nome_completo)) = LOWER(TRIM($7)))
    `, [siglaTurma, turno, situacaoFinal, arquivoMorto, cpf, matricula, nome]);

    console.log(`- ${nome} (${siglaTurma}): ${situacaoFinal} (arq_morto=${arquivoMorto}) -> Updated ${res.rowCount} rows`);
  }

  // Verificação final do 1º ano no banco
  const res1anoAtivos = await client.query(`
    SELECT turma_atual, count(*) 
    FROM alunos 
    WHERE turma_atual IN ('1AM01', '1AT02') AND arquivo_morto = 0 AND situacao = 'Matriculado'
    GROUP BY turma_atual
    ORDER BY turma_atual
  `);
  console.log("\nAlunos Ativos no 1º Ano após ajuste:", res1anoAtivos.rows);

  await client.end();
}

main().catch(console.error);

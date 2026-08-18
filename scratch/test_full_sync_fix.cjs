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
  console.log("=== EXECUTANDO SINCRONIZAÇÃO COMPLETA E ROBUSTA DE TODOS OS ALUNOS (2026) ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total de linhas lidas no Excel: ${rows.length}`);

  // 1. Resetar status de arquivo_morto para 1 temporariamente para reavaliação estrita
  await client.query("UPDATE alunos SET arquivo_morto = 1, situacao = 'Transferido'");

  let atualizados = 0;
  let inseridos = 0;
  let erros = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
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

      // 1. Tentar UPDATE por Matrícula se existir
      let updateRes = { rowCount: 0 };
      if (matricula) {
        updateRes = await client.query(`
          UPDATE alunos
          SET nome_completo = $1,
              turma_atual = $2,
              turno = $3,
              situacao = $4,
              arquivo_morto = $5,
              cpf = COALESCE($6, cpf),
              motivo_saida = CASE WHEN $5 = 0 THEN NULL ELSE motivo_saida END
          WHERE matricula = $7
        `, [nome, siglaTurma, turno, situacaoFinal, arquivoMorto, cpf, matricula]);
      }

      // 2. Se não atualizou por matrícula, tentar UPDATE por Nome Completo (case insensitive + trimmed)
      if (updateRes.rowCount === 0) {
        updateRes = await client.query(`
          UPDATE alunos
          SET matricula = COALESCE($1, matricula),
              turma_atual = $2,
              turno = $3,
              situacao = $4,
              arquivo_morto = $5,
              cpf = COALESCE($6, cpf),
              motivo_saida = CASE WHEN $5 = 0 THEN NULL ELSE motivo_saida END
          WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM($7))
        `, [matricula || null, siglaTurma, turno, situacaoFinal, arquivoMorto, cpf, nome]);
      }

      // 3. Se ainda não existia no banco, INSERT
      if (updateRes.rowCount === 0) {
        await client.query(`
          INSERT INTO alunos (matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [matricula || null, nome, siglaTurma, turno, situacaoFinal, arquivoMorto, cpf]);
        inseridos++;
      } else {
        atualizados++;
      }

    } catch (err) {
      erros++;
      console.error(`Erro na linha ${i} (${r['Nome']}):`, err.message);
    }
  }

  console.log(`\nFim do processamento: ${atualizados} atualizados, ${inseridos} inseridos, ${erros} erros.`);

  // 4. Verificação de Alunos do 1º Ano após sincronização
  const res1ano = await client.query(`
    SELECT turma_atual, situacao, count(*)
    FROM alunos
    WHERE turma_atual IN ('1AM01', '1AT02') AND arquivo_morto = 0
    GROUP BY turma_atual, situacao
    ORDER BY turma_atual
  `);
  console.log("\nAlunos do 1º Ano Ativos no Banco agora:", res1ano.rows);

  // 5. Total de Matriculados em todas as 14 turmas
  const resTotalAtivos = await client.query(`
    SELECT count(*) FROM alunos WHERE arquivo_morto = 0 AND situacao = 'Matriculado'
  `);
  console.log(`\nTotal de Alunos Matriculados no Banco (Dashboard): ${resTotalAtivos.rows[0].count}`);

  const resPorTurma = await client.query(`
    SELECT turma_atual, count(*)
    FROM alunos
    WHERE arquivo_morto = 0 AND situacao = 'Matriculado'
    GROUP BY turma_atual
    ORDER BY turma_atual
  `);
  console.log("\nDetalhamento dos 239 Alunos Matriculados por Turma (2026):", resPorTurma.rows);

  await client.end();
}

main().catch(console.error);

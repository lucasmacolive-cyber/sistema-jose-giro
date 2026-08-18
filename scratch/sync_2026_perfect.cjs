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
  console.log("=== SINCRONIZANDO ESTRITAMENTE O BANCO COM O RELATÓRIO 2026 (239 MATRICULADOS EM 14 TURMAS) ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  if (!fs.existsSync(xlsPath)) {
    console.error("Relatorio (1).xls não encontrado!");
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total de linhas no relatório 2026: ${rows.length}`);

  // 1. Tabela Turmas: Resetar para as 14 turmas oficiais
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
  console.log("✓ 14 Turmas oficiais salvas em 'turmas'.");

  // 2. Colocar todos os alunos atuais como arquivo_morto = 1 por padrão
  await client.query("UPDATE alunos SET arquivo_morto = 1, situacao = 'Transferido'");

  // 3. Processar cada linha de Relatorio (1).xls
  let countAtivos = 0;
  let countInativos = 0;

  for (const r of rows) {
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

    if (isMatriculado) countAtivos++;
    else countInativos++;

    if (matricula) {
      // Upsert por Matrícula
      await client.query(`
        INSERT INTO alunos (matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (matricula) DO UPDATE SET
          nome_completo = EXCLUDED.nome_completo,
          turma_atual = EXCLUDED.turma_atual,
          turno = EXCLUDED.turno,
          situacao = EXCLUDED.situacao,
          arquivo_morto = EXCLUDED.arquivo_morto,
          cpf = COALESCE(EXCLUDED.cpf, alunos.cpf),
          motivo_saida = CASE WHEN EXCLUDED.arquivo_morto = 0 THEN NULL ELSE alunos.motivo_saida END
      `, [matricula, nome, siglaTurma, turno, situacaoFinal, arquivoMorto, cpf]);
    } else {
      // Sem matrícula: update ou insert por nome
      const resName = await client.query(`
        UPDATE alunos
        SET turma_atual = $1, turno = $2, situacao = $3, arquivo_morto = $4, cpf = COALESCE($5, cpf)
        WHERE LOWER(TRIM(nome_completo)) = LOWER(TRIM($6))
      `, [siglaTurma, turno, situacaoFinal, arquivoMorto, cpf, nome]);

      if (resName.rowCount === 0) {
        await client.query(`
          INSERT INTO alunos (nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [nome, siglaTurma, turno, situacaoFinal, arquivoMorto, cpf]);
      }
    }
  }

  // 4. Verificação Final
  const resAtivos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 0 AND situacao = 'Matriculado'");
  const resMortos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 1");
  const resPorTurma = await client.query(`
    SELECT turma_atual, count(*) 
    FROM alunos 
    WHERE arquivo_morto = 0 AND situacao = 'Matriculado'
    GROUP BY turma_atual 
    ORDER BY turma_atual
  `);

  console.log("\n=== CONTAGEM FINAL NO BANCO ===");
  console.log(`Turmas Ativas: 14`);
  console.log(`Alunos MATRICULADOS no Banco (Dashboard): ${resAtivos.rows[0].count}`);
  console.log(`Alunos Arquivados/Transferidos no Banco: ${resMortos.rows[0].count}`);
  console.log("\nAlunos Matriculados por Turma (2026):", resPorTurma.rows);

  await client.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});

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
  console.log("=== RESTAURANDO ALUNOS A PARTIR DE Relatorio (1).xls ===");

  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  if (!fs.existsSync(xlsPath)) {
    console.error("Arquivo Relatorio (1).xls não encontrado!");
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map(c => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", range: headerRowIdx });
  console.log(`Linhas lidas do Excel: ${rows.length}`);

  // Primeiro: Desarquivar todos os alunos que sofreram arquivamento indevido pelo motivo de sync de hoje
  const resReset = await client.query(`
    UPDATE alunos
    SET arquivo_morto = 0,
        situacao = 'Matriculado',
        motivo_saida = NULL,
        data_saida = NULL,
        data_transferencia = NULL
    WHERE motivo_saida = 'Não consta no relatório SUAP (Sincronização)'
  `);
  console.log(`Alunos restaurados em lote da sincronização indevida: ${resReset.rowCount}`);

  // Segundo: Atualizar com dados do Excel se houver algum status específico
  let restaurados = 0;
  for (const r of rows) {
    const colunas = Object.keys(r);
    const getVal = (keys) => {
      for (const k of keys) {
        const found = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
        if (found && r[found]) return String(r[found]).trim();
      }
      return "";
    };

    const nome = getVal(["nome completo", "nome do aluno", "nome"]);
    const matricula = getVal(["matrícula", "matricula", "mat."]);
    const situacaoRaw = getVal(["situação no curso", "situacao no curso", "situação", "situacao", "status"]);
    const isMatriculado = !situacaoRaw || situacaoRaw.toLowerCase().includes("matriculado");

    if (!nome || nome.length < 3) continue;

    const res = await client.query(`
      UPDATE alunos
      SET arquivo_morto = $1,
          situacao = $2,
          motivo_saida = CASE WHEN $1 = 0 THEN NULL ELSE motivo_saida END
      WHERE (matricula IS NOT NULL AND matricula = $3 AND $3 != '')
         OR (LOWER(TRIM(nome_completo)) = LOWER(TRIM($4)))
    `, [isMatriculado ? 0 : 1, isMatriculado ? "Matriculado" : situacaoRaw, matricula, nome]);

    if (res.rowCount > 0) {
      restaurados += res.rowCount;
    }
  }

  console.log(`Atualizados especificamente via Excel: ${restaurados}`);

  // Verificar contagem atual no banco
  const resAtivos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 0");
  const resMortos = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 1");
  const resDashboard = await client.query("SELECT count(*) FROM alunos WHERE arquivo_morto = 0 AND situacao = 'Matriculado'");

  console.log("\n=== STATUS FINAL APÓS RESTAURAÇÃO ===");
  console.log(`Alunos ATIVOS (arquivo_morto = 0): ${resAtivos.rows[0].count}`);
  console.log(`Alunos ARQUIVADOS (arquivo_morto = 1): ${resMortos.rows[0].count}`);
  console.log(`Alunos MATRICULADOS (Dashboard): ${resDashboard.rows[0].count}`);

  await client.end();
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});

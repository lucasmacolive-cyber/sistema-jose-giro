import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import pkg from "xlsx";
const { readFile, utils } = pkg;

import { sincronizarSUAP } from "../api/lib/suapSync.ts";
import { processarImportacaoAlunos } from "../api/services/importService.ts";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const val = (row: any, col: string | undefined): string =>
  col ? String(row[col] ?? "").trim() : "";

const extrairTurma = (rawCell: string) => {
  if (!rawCell) return "";
  const raw = String(rawCell).trim();
  const mParen = raw.match(/\(([^)]+)\)/);
  if (mParen && mParen[1]) {
    const inside = mParen[1].trim();
    if (!/^(19|20)\d{2}(\.[0-9]+|\/[0-9]+)?$/.test(inside)) {
      return inside;
    }
  }
  const before = raw.split("(")[0].trim();
  return (before.length <= 20) ? before : raw;
};

async function main() {
  console.log("=================================================");
  console.log("1. CAPTURANDO ESTADO ANTERIOR (BEFORE) DO BANCO");
  console.log("=================================================");

  const beforeRes = await pool.query(`
    SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto, cpf, sexo 
    FROM alunos 
    ORDER BY nome_completo;
  `);
  const dbBefore = beforeRes.rows;
  console.log(`Total de alunos no banco (ANTES): ${dbBefore.length}`);
  
  const ano1Before = dbBefore.filter(a => 
    a.arquivo_morto === 0 && (a.turma_atual === '1AM01' || a.turma_atual === '1AT02')
  );
  console.log(`Alunos do 1º ano ativos (ANTES): ${ano1Before.length}`);

  console.log("\n=================================================");
  console.log("2. CONECTANDO AO SUAP E BAIXANDO RELATÓRIO AO VIVO");
  console.log("=================================================");

  let usuario = process.env.SUAP_USUARIO ?? "21501";
  let senha = process.env.SUAP_SENHA ?? "12314569733";

  console.log(`Usuário SUAP: ${usuario}`);

  const onProgress = (pct: number, msg: string) => {
    console.log(`[SUAP Sync ${pct}%] ${msg}`);
  };

  const xlsBuffer = await sincronizarSUAP(usuario, senha, onProgress);
  const liveXlsPath = path.join(process.cwd(), "scratch", "SUAP_Live_Relatorio.xls");
  fs.writeFileSync(liveXlsPath, xlsBuffer);
  console.log(`Relatório salvo em: ${liveXlsPath} (${xlsBuffer.length} bytes)`);

  console.log("\n=================================================");
  console.log("3. PARSEANDO E ANALISANDO RELATÓRIO DO SUAP");
  console.log("=================================================");

  const wb = readFile(liveXlsPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows: Record<string, any>[] = utils.sheet_to_json(sheet, {
    defval: "",
    range: headerRowIdx,
  });

  console.log(`Linha do cabeçalho detectada: ${headerRowIdx}`);
  console.log(`Total de linhas de alunos na planilha do SUAP: ${rows.length}`);

  const colunas = Object.keys(rows[0]);
  const mapearColuna = (chaves: string[]): string | undefined => {
    for (const k of chaves) {
      const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (match) return match;
    }
    return undefined;
  };

  const colNome = mapearColuna(["nome completo", "nome do aluno", "nome"]);
  const colTurma = mapearColuna(["turma", "turma/série"]);
  const colMatricula = mapearColuna(["matrícula", "matricula", "mat."]);
  const colCPF = mapearColuna(["cpf"]);
  const colSexo = mapearColuna(["sexo", "gênero", "genero"]);

  console.log("\n=================================================");
  console.log("4. COMPARANDO PLANILHA DO SUAP COM BANCO (BEFORE)");
  console.log("=================================================");

  let divergencias1Ano: any[] = [];
  let divergenciasGerais: any[] = [];

  for (const r of rows) {
    const nomeExcel = val(r, colNome);
    const matExcel = val(r, colMatricula);
    const cpfExcel = val(r, colCPF);
    const cpfClean = cpfExcel ? cpfExcel.replace(/\D/g, "") : "";
    const rawTurma = val(r, colTurma);
    const turmaExcelExtraida = extrairTurma(rawTurma);
    const sexo = val(r, colSexo);

    if (!nomeExcel || nomeExcel.length < 3) continue;

    let dbStudent = dbBefore.find(a => a.cpf && String(a.cpf).replace(/\D/g, "") === cpfClean);
    if (!dbStudent && matExcel) dbStudent = dbBefore.find(a => a.matricula === matExcel);
    if (!dbStudent) dbStudent = dbBefore.find(a => String(a.nome_completo).toLowerCase().trim() === nomeExcel.toLowerCase().trim());

    if (dbStudent) {
      const turmaDb = (dbStudent.turma_atual ?? "").trim();
      const is1AnoDb = turmaDb.toUpperCase().includes("1A");
      const is1AnoExcel = turmaExcelExtraida.toUpperCase().includes("1A");

      if (turmaDb.toLowerCase() !== turmaExcelExtraida.toLowerCase()) {
        const item = {
          id: dbStudent.id,
          nome: dbStudent.nome_completo,
          matricula: dbStudent.matricula,
          sexo: sexo || dbStudent.sexo,
          turmaNoBanco: turmaDb,
          turmaNoSUAP: turmaExcelExtraida,
          turmaBrutaSUAP: rawTurma
        };
        divergenciasGerais.push(item);
        if (is1AnoDb || is1AnoExcel) {
          divergencias1Ano.push(item);
        }
      }
    }
  }

  console.log(`\nTotal de divergências encontradas no relatório SUAP vs Banco: ${divergenciasGerais.length}`);
  if (divergencias1Ano.length > 0) {
    console.log(`\n!!! DIVERGÊNCIAS NO 1º ANO (SUAP vs BANCO) !!!`);
    console.table(divergencias1Ano);
  } else {
    console.log("\nNenhuma divergência no 1º ano detectada entre a planilha do SUAP e o banco de dados.");
  }

  console.log("\n=================================================");
  console.log("5. EXECUTANDO ATUALIZAÇÃO DOS DADOS NO BANCO DE DADOS");
  console.log("=================================================");

  const importResult = await processarImportacaoAlunos(rows, { substituirTudo: true });
  console.log("Resultado do processarImportacaoAlunos:", importResult);

  console.log("\n=================================================");
  console.log("6. VERIFICANDO ESTADO APÓS ATUALIZAÇÃO (AFTER)");
  console.log("=================================================");

  const afterRes = await pool.query(`
    SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto 
    FROM alunos 
    ORDER BY nome_completo;
  `);
  const dbAfter = afterRes.rows;

  const totalVivos = dbAfter.filter(a => a.arquivo_morto === 0);
  const totalMortos = dbAfter.filter(a => a.arquivo_morto === 1);

  console.log(`Total de alunos no banco (DEPOIS): ${dbAfter.length}`);
  console.log(`Alunos ativos (arquivo_morto = 0): ${totalVivos.length}`);
  console.log(`Alunos arquivados (arquivo_morto = 1): ${totalMortos.length}`);

  const ano1After1AM = dbAfter.filter(a => a.arquivo_morto === 0 && a.turma_atual === '1AM01');
  const ano1After1AT = dbAfter.filter(a => a.arquivo_morto === 0 && a.turma_atual === '1AT02');

  console.log(`Alunos 1º Ano Manhã (1AM01) DEPOIS: ${ano1After1AM.length}`);
  console.log(`Alunos 1º Ano Tarde (1AT02) DEPOIS: ${ano1After1AT.length}`);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error("Erro na sincronização:", err);
  process.exit(1);
});

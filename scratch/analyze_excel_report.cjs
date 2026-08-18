const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function main() {
  const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
  if (!fs.existsSync(xlsPath)) {
    console.error("Relatorio (1).xls não foi encontrado!");
    return;
  }

  const workbook = XLSX.readFile(xlsPath);
  console.log("Planilhas no arquivo:", workbook.SheetNames);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`Total de linhas brutas na matriz: ${rawMatrix.length}`);

  // Procurar cabeçalho
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map(c => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  console.log(`Linha do cabeçalho detectada: ${headerRowIdx}`);
  console.log("Conteúdo da linha de cabeçalho:", rawMatrix[headerRowIdx]);

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", range: headerRowIdx });
  console.log(`\nTotal de registros (linhas de alunos) lidos: ${rows.length}`);

  const colunas = Object.keys(rows[0] || {});
  console.log("\nColunas encontradas:", colunas);

  // Mapeamento
  const getVal = (r, keys) => {
    for (const k of keys) {
      const found = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (found && r[found] !== undefined && r[found] !== null) return String(r[found]).trim();
    }
    return "";
  };

  const porTurma = {};
  const porSituacao = {};
  let comNomeValido = 0;

  for (const r of rows) {
    const nome = getVal(r, ["nome completo", "nome do aluno", "nome"]);
    const turmaRaw = getVal(r, ["turma", "turma/série"]);
    const situacao = getVal(r, ["situação no curso", "situacao no curso", "situação", "situacao", "status"]);

    if (!nome || nome.length < 3) continue;
    comNomeValido++;

    porTurma[turmaRaw] = (porTurma[turmaRaw] || 0) + 1;
    porSituacao[situacao] = (porSituacao[situacao] || 0) + 1;
  }

  console.log(`\nLinhas com nome válido: ${comNomeValido}`);
  console.log("\nAlunos por Situação no Excel:", porSituacao);
  console.log("\nAlunos por Turma no Excel:", porTurma);
}

main().catch(console.error);

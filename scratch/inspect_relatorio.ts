// @ts-nocheck
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';

async function run() {
  try {
    const filePath = path.resolve('Relatorio (1).xls');
    console.log("Lendo arquivo:", filePath);
    const workbook = readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });
    console.log("Total de linhas na matriz bruta:", rawMatrix.length);
    
    // Encontrar linha do cabeçalho
    const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawMatrix.length, 30); i++) {
      const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
      const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
      if (acertos >= 2) { 
        headerRowIdx = i; 
        break; 
      }
    }
    
    if (headerRowIdx === -1) {
      console.log("Não foi possível encontrar uma linha de cabeçalho padrão. Exibindo primeiras 10 linhas:");
      for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
        console.log(`Linha ${i}:`, rawMatrix[i].slice(0, 10));
      }
      return;
    }
    
    console.log("Cabeçalho encontrado na linha:", headerRowIdx);
    const headerRow = rawMatrix[headerRowIdx];
    console.log("Colunas encontradas (total):", headerRow.length);
    
    // Mostrar colunas por índice e letra
    const indexToLetter = (index: number) => {
      let temp = index;
      let letter = "";
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };
    
    for (let j = 0; j < headerRow.length; j++) {
      const colName = headerRow[j];
      if (colName) {
        console.log(`Índice ${j} (Coluna ${indexToLetter(j)}): "${colName}"`);
      }
    }
    
    // Re-parsear como JSON a partir da linha de cabeçalho
    const rows = utils.sheet_to_json(sheet, { range: headerRowIdx, defval: "" });
    console.log("Total de registros parseados:", rows.length);
    if (rows.length > 0) {
      console.log("Exemplo do primeiro registro completo:");
      console.log(JSON.stringify(rows[0], null, 2));
    }
  } catch (err) {
    console.error("Erro ao ler planilha:", err);
  }
}

run();

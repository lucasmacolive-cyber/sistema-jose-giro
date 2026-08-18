import pkg from 'xlsx';
const { readFile, utils } = pkg;
import fs from 'fs';
import path from 'path';

async function testXls() {
  const xlsPath = path.join(process.cwd(), 'Relatorio (1).xls');
  console.log("Reading file:", xlsPath);

  if (!fs.existsSync(xlsPath)) {
    console.log("File does not exist!");
    return;
  }

  const wb = readFile(xlsPath);
  console.log("Sheet names:", wb.SheetNames);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log("Total raw rows:", rawMatrix.length);
  console.log("First 10 raw rows:");
  for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
    console.log(`Row ${i}:`, rawMatrix[i].slice(0, 10));
  }

  // Detect header row logic from sync.ts
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  console.log("Detected headerRowIdx:", headerRowIdx);
  if (headerRowIdx < rawMatrix.length) {
    console.log("Header row contents:", rawMatrix[headerRowIdx]);
  }

  const rows: Record<string, any>[] = utils.sheet_to_json(sheet, {
    defval: "",
    range: headerRowIdx,
  });

  console.log("Parsed rows count:", rows.length);
  if (rows.length > 0) {
    console.log("First parsed row keys:", Object.keys(rows[0]));
    console.log("First parsed row sample:", rows[0]);
  }
}

testXls();

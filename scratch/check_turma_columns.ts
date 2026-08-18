import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';

function inspectFile(filename: string) {
  const xlsPath = path.join(process.cwd(), filename);
  if (!require('fs').existsSync(xlsPath)) return;

  console.log(`\n========================================`);
  console.log(`File: ${filename}`);

  const wb = readFile(xlsPath);
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

  if (rows.length === 0) return;

  const colunas = Object.keys(rows[0]);
  console.log("All columns containing 'turma' or 'turno' (case-insensitive):");
  colunas.forEach((col, idx) => {
    if (col.toLowerCase().includes("turma") || col.toLowerCase().includes("turno")) {
      console.log(`  Col [${idx}]: "${col}" -> Sample value: "${rows[0][col]}"`);
    }
  });
}

inspectFile('Relatorio (1).xls');
inspectFile('attached_assets/Relatorio_(18)_1775062997555.xls');
inspectFile('attached_assets/Relatorio_1775062608705.xls');

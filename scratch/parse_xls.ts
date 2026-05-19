import * as XLSX from "xlsx";
import * as path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "Relatorio (1).xls");
  console.log(`Lendo arquivo: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }
  
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    range: headerRowIdx,
  });
  
  console.log(`Total de linhas carregadas: ${rows.length}`);
  if (rows.length === 0) return;
  
  const colunas = Object.keys(rows[0]);
  const colTurma = colunas.find(c => c.toLowerCase().includes("turma"));
  if (!colTurma) {
    console.error("Coluna 'Turma' não encontrada nas colunas:", colunas);
    return;
  }
  
  console.log(`Coluna de turma identificada: "${colTurma}"`);
  
  const turmasSet = new Set<string>();
  const parentesesSet = new Set<string>();
  
  for (const r of rows) {
    const rawVal = String(r[colTurma] ?? "").trim();
    if (rawVal) {
      turmasSet.add(rawVal);
      const match = rawVal.match(/\(([^)]+)\)/);
      if (match) {
        parentesesSet.add(match[1].trim());
      }
    }
  }
  
  console.log("\n=== TODAS AS TURMAS ORIGINAIS (CRUAS) NO XLS ===");
  for (const t of [...turmasSet].sort()) {
    console.log(`- ${t}`);
  }
  
  console.log("\n=== TURMAS EXTRAÍDAS DE DENTRO DOS PARÊNTESES ===");
  for (const p of [...parentesesSet].sort()) {
    console.log(`- ${p}`);
  }
}

main().catch(console.error);

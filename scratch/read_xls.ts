import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

function run() {
  const filePath = path.resolve("Relatorio (1).xls");
  console.log(`Lendo arquivo: ${filePath}`);
  
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
  if (rows.length > 0) {
    console.log("Quantidade de linhas (alunos):", rows.length);
    console.log("\nColunas encontradas:");
    console.log(Object.keys(rows[0]).join(", "));
    
    console.log("\nPrimeiro registro (exemplo):");
    console.log(JSON.stringify(rows[0], null, 2));
  } else {
    console.log("O arquivo parece estar vazio.");
  }
}

try {
  run();
} catch (e) {
  console.error(e);
}

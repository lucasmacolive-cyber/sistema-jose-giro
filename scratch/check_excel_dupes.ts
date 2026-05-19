import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

function run() {
  const filePath = path.resolve("Relatorio (1).xls");
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
  const matriculas = new Set();
  const nomes = new Set();
  
  for (const row of rows) {
    const mat = row["Matrícula"];
    const nome = row["Nome"];
    
    if (mat) {
      if (matriculas.has(mat)) {
        console.log("Duplicate Matricula in file:", mat, "for student", nome);
      }
      matriculas.add(mat);
    }
    
    if (nome) {
      if (nomes.has(nome)) {
        console.log("Duplicate Nome in file:", nome);
      }
      nomes.add(nome);
    }
  }
}

try {
  run();
} catch (e) {
  console.error(e);
}

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
  
  const row = rows.find(r => r["Matrícula"] === "20241021610040");
  console.log("Row in Excel:", row["Nome"], row["Matrícula"], row["CPF"]);
}

run();

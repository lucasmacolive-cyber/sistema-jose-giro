import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function main() {
  const pdfPath = path.join(process.cwd(), "attached_assets", "diário_do_1AM01_1774751670076.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found at:", pdfPath);
    return;
  }

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  const text = data.text;
  const lines = text.split("\n").map((l: string) => l.trim());
  
  // Find lines starting with a student number and enrollment (like "1 202")
  const studentRegex = /^\s*(\d+)\s+(\d{10,})\s+(.+)/;
  
  console.log("=== EXAMPLES OF STUDENT LINES ===");
  for (const line of lines) {
    if (studentRegex.test(line)) {
      console.log(line);
    }
  }
}

main().catch(console.error);

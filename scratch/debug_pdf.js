const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

async function main() {
  const pdfPath = path.join(process.cwd(), "attached_assets", "diário_do_1AM01_1774933530178.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF not found at:", pdfPath);
    return;
  }

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);
  const text = data.text;
  const lines = text.split("\n").map(l => l.trimEnd());
  
  console.log("=== TOTAL LINES IN PDF:", lines.length);
  
  // Find lines starting with a student number and enrollment
  const studentRegex = /^\s*(\d+)\s+(\d{10,})\s+(.+)/;
  
  console.log("=== EXAMPLES OF STUDENT LINES ===");
  let count = 0;
  for (const line of lines) {
    if (studentRegex.test(line)) {
      console.log(line);
      count++;
      if (count >= 15) break; // just show some examples
    }
  }
}

main().catch(console.error);

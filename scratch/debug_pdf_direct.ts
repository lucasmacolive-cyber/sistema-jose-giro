import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

async function main() {
  const pdfPath = path.join(process.cwd(), "attached_assets", "diário_do_1AM01_1774933530178.pdf");
  console.log("Reading PDF from:", pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF does not exist!");
    return;
  }
  const buffer = fs.readFileSync(pdfPath);
  console.log("File loaded. Buffer length:", buffer.length);
  console.log("Parsing PDF...");
  const data = await pdfParse(buffer);
  console.log("Parsed! Text length:", data.text ? data.text.length : 0);
  
  const textOut = data.text || "";
  fs.writeFileSync(path.join(process.cwd(), "scratch", "pdf_output.txt"), textOut);
  console.log("Output written to scratch/pdf_output.txt successfully.");
}

main().catch(console.error);

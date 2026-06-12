import fs from "fs";
import path from "path";
import { parseDiarioPDF } from "../api/lib/parseDiario";

async function main() {
  const pdfPath = path.join(process.cwd(), "attached_assets", "diário_do_1AM01_1774933530178.pdf");
  console.log("Reading PDF from:", pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF does not exist!");
    return;
  }
  const buffer = fs.readFileSync(pdfPath);
  console.log("Parsing PDF...");
  const { secoes, erros } = await parseDiarioPDF(buffer);
  
  console.log("Parsed! Total sections found:", secoes.length);
  if (erros.length > 0) {
    console.warn("Parsing errors:", erros);
  }
  
  for (let i = 0; i < secoes.length; i++) {
    const secao = secoes[i];
    console.log(`\n--- Seção ${i + 1} ---`);
    console.log(`Turma Código: ${secao.turmaCodigo}`);
    console.log(`Turma Local: ${secao.turmaLocal}`);
    console.log(`Bimestre: ${secao.bimestre}`);
    console.log(`Ano: ${secao.ano}`);
    console.log(`Disciplina: ${secao.disciplina}`);
    console.log(`Professor Regente: ${secao.professorRegente}`);
    
    // Print first 5 students' grades and absence summaries
    console.log("Alunos (Apenas primeiros 5 para depuração):");
    const sampleAlunos = secao.alunos.slice(0, 5);
    for (const al of sampleAlunos) {
      console.log(`  - Matrícula: ${al.matricula} | Nome: ${al.nome}`);
      console.log(`    Nota: ${al.nota !== undefined ? al.nota : "NÃO PARSEADO"} | Total Faltas: ${al.totalFaltasPDF}`);
    }
  }
}

main().catch(console.error);

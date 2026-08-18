import pkg from 'xlsx';
const { readFile, utils } = pkg;
import path from 'path';

const xlsPath = path.join(process.cwd(), 'Relatorio (1).xls');
const wb = readFile(xlsPath);
const sheet = wb.Sheets[wb.SheetNames[0]];

const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });

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

console.log("Total rows in file:", rows.length);

const colunas = Object.keys(rows[0]);
const mapearColuna = (chaves: string[], fallbackIdx?: number): string | undefined => {
  for (const k of chaves) {
    const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
    if (match) return match;
  }
  if (fallbackIdx !== undefined && fallbackIdx >= 0 && fallbackIdx < colunas.length) {
    return colunas[fallbackIdx];
  }
  return undefined;
};

const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."], 1);
const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"], 2);
const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);

console.log("colMatricula:", colMatricula);
console.log("colNome:", colNome);
console.log("colSituacao:", colSituacao);

const matriculasNoArquivo = new Set<string>();
const nomesNoArquivo = new Set<string>();

let validCount = 0;
let invalidCount = 0;

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const matricula = colMatricula ? String(row[colMatricula] ?? "").trim() : "";
  const nomeCompleto = colNome ? String(row[colNome] ?? "").trim() : "";
  
  if (!nomeCompleto || nomeCompleto.length < 3) {
    invalidCount++;
    console.log(`Row ${i} skipped: invalid name "${nomeCompleto}"`);
    continue;
  }
  validCount++;
  if (matricula) matriculasNoArquivo.add(matricula);
  nomesNoArquivo.add(nomeCompleto.toLowerCase().trim());
}

console.log(`Valid rows: ${validCount}, Invalid/skipped: ${invalidCount}`);
console.log("Total matriculas set size:", matriculasNoArquivo.size);
console.log("Total nomes set size:", nomesNoArquivo.size);

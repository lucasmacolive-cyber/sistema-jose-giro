import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { db, alunosTable } from "../api/lib/db/index.ts";
import { eq, inArray } from "drizzle-orm";
import path from "path";

const xlsPath = path.join(process.cwd(), "Relatorio (1).xls");
const workbook = readFile(xlsPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows: any[] = utils.sheet_to_json(sheet, { defval: "" });

function norm(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanCPF(val: any): string {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0");
}

async function fixDatabase() {
  console.log("=== EXECUTANDO CORREÇÃO E LIMPEZA DA BASE DE DADOS DOS ALUNOS ===");

  const xlsMap = new Map<string, any>();
  for (const r of rows) {
    const cpf = cleanCPF(r["CPF"]);
    const mat = String(r["Matrícula"] || "").trim();
    const nome = norm(r["Nome do Aluno"]);
    if (cpf) xlsMap.set(`cpf:${cpf}`, r);
    if (mat) xlsMap.set(`mat:${mat}`, r);
    if (nome) xlsMap.set(`nome:${nome}`, r);
  }

  const allDb = await db.select().from(alunosTable);

  const duplicadosParaDeletar: number[] = [];
  for (const a of allDb) {
    if (a.id >= 349) {
      duplicadosParaDeletar.push(a.id);
    }
  }

  if (duplicadosParaDeletar.length > 0) {
    console.log(`Removendo ${duplicadosParaDeletar.length} registros duplicados (IDs ${duplicadosParaDeletar[0]} a ${duplicadosParaDeletar[duplicadosParaDeletar.length - 1]})...`);
    for (const id of duplicadosParaDeletar) {
      await db.delete(alunosTable).where(eq(alunosTable.id, id));
    }
    console.log("✓ Duplicados removidos com sucesso.");
  }

  // Restaurar alunos legítimos (IDs < 349)
  let restauradosCount = 0;
  for (const a of allDb) {
    if (a.id < 349) {
      const cpf = cleanCPF(a.cpf);
      const mat = String(a.matricula || "").trim();
      const nome = norm(a.nomeCompleto);

      const xlsRow = xlsMap.get(`cpf:${cpf}`) || xlsMap.get(`mat:${mat}`) || xlsMap.get(`nome:${nome}`);
      
      const sitXls = xlsRow ? (String(xlsRow["Situação"] || "").trim() || "Matriculado") : "Matriculado";
      const turmaXls = xlsRow ? (String(xlsRow["Turma"] || "").trim() || a.turmaAtual) : a.turmaAtual;

      await db.update(alunosTable)
        .set({
          arquivoMorto: sitXls.toLowerCase().includes("transferido") ? 1 : 0,
          situacao: sitXls,
          turmaAtual: turmaXls,
          motivoSaida: null,
          dataSaida: null,
          dataTransferencia: null,
          tipoTransferencia: null
        })
        .where(eq(alunosTable.id, a.id));

      restauradosCount++;
    }
  }

  console.log(`✓ ${restauradosCount} cadastros originais restaurados e sincronizados.`);

  const apos = await db.select().from(alunosTable);
  const ativos = apos.filter(a => a.arquivoMorto === 0);
  const conflitos = apos.filter(a => a.arquivoMorto === 0 && a.situacao.toLowerCase().includes("transferido"));

  console.log("\n=== STATUS APÓS CORREÇÃO ===");
  console.log(`Total de alunos no banco: ${apos.length}`);
  console.log(`Alunos ativos (arquivoMorto=0): ${ativos.length}`);
  console.log(`Alunos em conflito (situacao='Transferido', arquivoMorto=0): ${conflitos.length}`);

  process.exit(0);
}

fixDatabase().catch(err => {
  console.error("Erro ao executar correção:", err);
  process.exit(1);
});

import { db } from "../lib/db/src/index.js";
import { alunosTable } from "../lib/db/src/schema/index.js";
import { inArray } from "drizzle-orm";

async function run() {
  const existentes = await db.select().from(alunosTable);
  const byCpf = new Map<string, typeof existentes>();

  for (const a of existentes) {
    if (a.cpf) {
      const c = a.cpf.replace(/\D/g, "");
      if (c) {
        if (!byCpf.has(c)) byCpf.set(c, []);
        byCpf.get(c)!.push(a);
      }
    }
  }

  const idsToDelete: number[] = [];

  for (const [cpf, records] of byCpf.entries()) {
    if (records.length > 1) {
      // Pick the best one
      records.sort((a, b) => b.id - a.id);
      
      let best = records.find(r => r.turmaAtual && r.turmaAtual !== "");
      if (!best) best = records[0];

      for (const r of records) {
        if (r.id !== best.id) {
          idsToDelete.push(r.id);
        }
      }
    }
  }

  if (idsToDelete.length > 0) {
    console.log(`Deletando ${idsToDelete.length} CPFs duplicados...`);
    await db.delete(alunosTable).where(inArray(alunosTable.id, idsToDelete));
    console.log("Deletados.");
  } else {
    console.log("Nenhum CPF duplicado.");
  }

  process.exit(0);
}

run();

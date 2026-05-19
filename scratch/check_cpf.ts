import { db } from "../lib/db/src/index.js";
import { alunosTable } from "../lib/db/src/schema/index.js";

async function run() {
  const existentes = await db.select().from(alunosTable);
  const byCpf = existentes.filter(x => x.cpf && x.cpf.replace(/\D/g, "") === "22433467705");
  console.log("Records in DB with this CPF:", byCpf);
}

run();

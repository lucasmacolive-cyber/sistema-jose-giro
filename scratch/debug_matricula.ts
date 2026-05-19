import { db } from "../lib/db/src/index.js";
import { alunosTable } from "../lib/db/src/schema/index.js";

async function run() {
  const existentes = await db.select().from(alunosTable);
  const a = existentes.find(x => x.matricula === "20241021610040");
  console.log("Record in DB:", a);
  
  const mapMatricula = new Map(existentes.filter(a => a.matricula).map(a => [a.matricula, a.id]));
  console.log("Is it in mapMatricula?", mapMatricula.has("20241021610040"));
  console.log("mapMatricula keys count:", mapMatricula.size);
  
  process.exit(0);
}

run();

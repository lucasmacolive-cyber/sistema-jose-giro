import { db, turmasTable } from './lib/db/index.js';

async function run() {
  const turmas = await db.select().from(turmasTable);
  console.log(turmas);
  process.exit(0);
}

run();

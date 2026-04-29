import { db, professoresTable, funcionariosTable } from './src/lib/db/src/index.js';

async function run() {
  const p = await db.select().from(professoresTable);
  const f = await db.select().from(funcionariosTable);
  console.log('PROFESSORES:', p.length, 'FUNCIONARIOS:', f.length);
}
run();

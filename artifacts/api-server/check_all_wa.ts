import { db, configuracoesTable } from './src/lib/db/index.js';
import { like } from 'drizzle-orm';
async function run() {
  const rows = await db.select().from(configuracoesTable).where(like(configuracoesTable.chave, 'whatsapp_%'));
  console.log(rows);
  process.exit(0);
}
run();

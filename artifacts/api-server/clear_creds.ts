import { db, configuracoesTable } from './src/lib/db/index.js';
import { like } from 'drizzle-orm';
async function run() {
  await db.delete(configuracoesTable).where(like(configuracoesTable.chave, 'baileys_%'));
  console.log("Deleted all baileys creds");
  process.exit(0);
}
run();

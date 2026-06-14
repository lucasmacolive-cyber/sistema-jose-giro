import { db, configuracoesTable } from './src/lib/db/index.js';
import { eq } from 'drizzle-orm';
async function run() {
  await db.delete(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_pairing_code'));
  console.log('DELETED whatsapp code');
  process.exit(0);
}
run();

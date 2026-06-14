import { db, configuracoesTable } from './src/lib/db/index.js';
import { eq } from 'drizzle-orm';
async function run() {
  const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'whatsapp_pairing_code'));
  console.log(row);
  process.exit(0);
}
run();

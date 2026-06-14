import { db, configuracoesTable } from './src/lib/db/index.js';
import { eq } from 'drizzle-orm';
async function run() {
  const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, 'last_heartbeat_impressora'));
  if (row.length > 0) {
    const diff = (Date.now() - new Date(row[0].valor).getTime()) / 1000 / 60;
    console.log('Last heartbeat was', diff.toFixed(2), 'minutes ago');
    console.log('Online?', diff < 2);
  } else {
    console.log('No heartbeat row found, offline');
  }
  process.exit(0);
}
run();

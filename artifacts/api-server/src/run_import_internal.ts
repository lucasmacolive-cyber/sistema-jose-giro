// @ts-nocheck
import { importarAlunosXLS } from './services/importService';
import path from 'path';

async function run() {
  const p = path.join(process.cwd(), '..', '..', 'attached_assets', 'Relatorio.xls');
  console.log('Lendo arquivo:', p);
  try {
    const res = await importarAlunosXLS(p);
    console.log('RESULTADO DA IMPORTAÇÃO:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('ERRO NA IMPORTAÇÃO:', err);
  }
}

run();

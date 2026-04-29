// @ts-nocheck
import pkg from 'xlsx';
const { readFile, utils } = pkg;
import * as path from 'path';

const filePath = 'c:/Users/kjvtr/OneDrive/Área de Trabalho/pen drive lucas carro/Sistema-Jose-Giro-Faisca/attached_assets/Relatorio.xls';

try {
  const workbook = readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(worksheet);

  console.log('--- HEADERS ---');
  if (data.length > 0) {
    console.log(JSON.stringify(Object.keys(data[0]), null, 2));
  }

  console.log('\n--- FIRST ROW EXAMPLE ---');
  console.log(JSON.stringify(data[0], null, 2));
} catch (error) {
  console.error('Error reading XLS:', error);
}

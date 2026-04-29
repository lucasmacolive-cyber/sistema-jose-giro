import "dotenv/config";
import { importarAlunosXLS } from "../artifacts/api-server/src/services/importService";
import path from "path";

const xlsPath = 'c:/Users/kjvtr/OneDrive/Área de Trabalho/pen drive lucas carro/Sistema-Jose-Giro-Faisca/attached_assets/Relatorio.xls';

async function run() {
  console.log("Iniciando importação do SUAP...");
  try {
    const result = await importarAlunosXLS(xlsPath);
    console.log("Importação concluída!", result);
    process.exit(0);
  } catch (err) {
    console.error("Erro fatal na importação:", err);
    process.exit(1);
  }
}

run();

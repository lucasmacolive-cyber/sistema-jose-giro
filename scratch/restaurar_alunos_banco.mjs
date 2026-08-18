import path from "path";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { processarImportacaoAlunos } from "../api/services/importService.ts";
import pkg from 'xlsx';
const { readFile, utils } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function run() {
  console.log("Conectando ao banco de dados...");
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Restaurar os alunos inativados indevidamente
  console.log("Restaurando alunos marcados como 'Transferido' por erro de sincronização...");
  const resRestore = await pool.query(`
    UPDATE alunos 
    SET arquivo_morto = 0, 
        situacao = 'Matriculado', 
        motivo_saida = NULL, 
        data_saida = NULL, 
        data_transferencia = NULL 
    WHERE arquivo_morto = 1 
      AND (motivo_saida LIKE '%Não consta no relatório SUAP%' OR motivo_saida LIKE '%Sincronização%');
  `);
  console.log(`Linhas reativadas no banco: ${resRestore.rowCount}`);

  // 2. Importar o relatório com a nova lógica
  const fileXls = path.join(__dirname, "..", "attached_assets", "Relatorio_(18)_1775062997555.xls");
  console.log(`Lendo e importando planilha de alunos: ${fileXls}`);

  const workbook = readFile(fileXls);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawMatrix = utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows = utils.sheet_to_json(worksheet, { defval: "", range: headerRowIdx });
  console.log(`Total de registros na planilha: ${rows.length}`);

  const importRes = await processarImportacaoAlunos(rows, { substituirTudo: true });
  console.log("Importação concluída com sucesso!");
  console.log(`Novos alunos adicionados: ${importRes.adicionados}`);
  console.log(`Alunos atualizados: ${importRes.atualizados}`);
  console.log(`Alunos transferidos/arquivados: ${importRes.transferidos}`);
  
  const totalVivos = await pool.query("SELECT COUNT(*) FROM alunos WHERE arquivo_morto = 0;");
  console.log(`\n>>> TOTAL DE ALUNOS ATIVOS NO BANCO DE DADOS AGORA: ${totalVivos.rows[0].count} <<<`);

  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error("Erro na restauração:", err);
  process.exit(1);
});

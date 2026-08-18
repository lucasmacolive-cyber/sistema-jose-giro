import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import pkg from "xlsx";
const { readFile, utils } = pkg;

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const xlsPath = path.join(process.cwd(), 'Relatorio (1).xls');
  const wb = readFile(xlsPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  const PALAVRAS_CABECALHO = ["nome", "matrícula", "matricula", "turma", "situação", "situacao"];
  const rawMatrix: any[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" });

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 20); i++) {
    const rowJoined = rawMatrix[i].map((c: any) => String(c ?? "").toLowerCase()).join("|");
    const acertos = PALAVRAS_CABECALHO.filter(p => rowJoined.includes(p)).length;
    if (acertos >= 2) { headerRowIdx = i; break; }
  }

  const rows: Record<string, any>[] = utils.sheet_to_json(sheet, {
    defval: "",
    range: headerRowIdx,
  });

  const colunas = Object.keys(rows[0]);
  const mapearColuna = (chaves: string[], fallbackIdx?: number): string | undefined => {
    for (const k of chaves) {
      const match = colunas.find(c => c.toLowerCase().includes(k.toLowerCase()));
      if (match) return match;
    }
    if (fallbackIdx !== undefined && fallbackIdx >= 0 && fallbackIdx < colunas.length) {
      return colunas[fallbackIdx];
    }
    return undefined;
  };

  const colMatricula    = mapearColuna(["matrícula", "matricula", "mat."], 1);
  const colNome         = mapearColuna(["nome completo", "nome do aluno", "nome"], 2);
  const colTurma        = mapearColuna(["turma", "turma/série"], colunas.length > 74 ? 74 : 71);
  const colTurno        = mapearColuna(["turno"]);
  const colSituacao     = mapearColuna(["situação no curso", "situacao no curso", "situação no per", "situação", "situacao", "status"]);
  const colNascimento   = mapearColuna(["data de nascimento", "nascimento", "data nasc", "nascimento_data"]);
  const colCPF          = mapearColuna(["cpf"], 7);
  const colRG           = mapearColuna(["rg"]);
  const colMae          = mapearColuna(["nome da mãe", "nome da mae", "mãe", "mae", "nome_mae"]);
  const colPai          = mapearColuna(["nome do pai", "pai", "nome_pai"]);
  const colResponsavel  = mapearColuna(["responsável", "responsavel"]);
  const colTelefone     = mapearColuna(["telefone", "celular", "fone", "telefones"]);
  const colEndereco     = mapearColuna(["endereço", "endereco", "logradouro", "get_endereco"]);
  const colZona         = mapearColuna(["zona", "zona residencial", "zona_residencial"]);
  const colSexo         = mapearColuna(["sexo", "gênero", "genero"]);
  const colEtnia        = mapearColuna(["etnia", "raça", "raca", "cor/raça", "pessoa_fisica.raca"]);
  const colEmailPessoal = mapearColuna(["e-mail", "email", "e-mail do aluno", "pessoa_fisica.email"]);
  const colEmailResp    = mapearColuna(["e-mail do responsável", "email responsavel", "email_responsavel"]);
  const colAnoIngresso  = mapearColuna(["ano de ingresso", "ano ingresso", "ano_letivo"]);
  const colNivel        = mapearColuna(["nível de ensino", "nivel ensino", "nivel"]);
  const colCurso        = mapearColuna(["descrição do curso", "curso", "descricao do curso", "curso_campus.descricao"]);
  const colCodCurso     = mapearColuna(["código do curso", "cod curso", "codigo curso", "curso_campus.codigo"]);
  const colPrevisao     = mapearColuna(["ano de previsão", "previsao conclusao", "ano_let_prev_conclusao"]);
  const colNaturalidade = mapearColuna(["naturalidade", "cidade natural", "cidade de nascimento"]);

  console.log("Mapped columns:");
  console.log({ colMatricula, colNome, colTurma, colSituacao, colCPF, colNascimento });

  const dbAlunosRes = await pool.query("SELECT id, matricula, nome_completo, cpf FROM alunos;");
  const existentes = dbAlunosRes.rows;

  const val = (row: any, col: string | undefined): string =>
    col ? String(row[col] ?? "").trim() : "";

  let errors = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    try {
      const matricula = val(row, colMatricula);
      const nomeCompleto = val(row, colNome);
      const cpf = val(row, colCPF);
      console.log(`Processing row ${i}: nome=${nomeCompleto}, mat=${matricula}, cpf=${cpf}`);
    } catch (e: any) {
      errors++;
      console.error(`Error processing row ${i}:`, e.message);
    }
  }

  await pool.end();
}

main();

import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const suapList = [
    { mat: "20261031610002", nome: "AKILLA VITORIA CORDEIRO DE ALMEIDA", statusSuap: "Matriculado" },
    { mat: "20261031610003", nome: "ANNA JULIA LIMA DE SOUZA", statusSuap: "Transferido" },
    { mat: "20261031610005", nome: "BETANIA PAIXAO ROSA", statusSuap: "Matriculado" },
    { mat: "20261031610040", nome: "Bruna D a Silva Pasco", statusSuap: "Matriculado" },
    { mat: "20261031610018", nome: "BYANCA MENDES DE FREITAS", statusSuap: "Matriculado" },
    { mat: "20261031610006", nome: "CHRISTHOPHER DO COUTO BERNARDO SANTANA", statusSuap: "Transferido" },
    { mat: "20261031610007", nome: "ELOA NETO BENTO", statusSuap: "Matriculado" },
    { mat: "20261031610008", nome: "EMILLY DA SILVA NASCIMENTO", statusSuap: "Matriculado" },
    { mat: "20261031610009", nome: "HELOA ALMEIDA DA SILVA GOMES", statusSuap: "Matriculado" },
    { mat: "20261031610024", nome: "HEYTOR ALVES", statusSuap: "Matriculado" },
    { mat: "20261031610010", nome: "ISIS EMANUELLY SANTANA DE AGUIAR", statusSuap: "Transferido" },
    { mat: "20261031610011", nome: "KEYLLOR GOMES RANGEL", statusSuap: "Transferido" },
    { mat: "20261031610027", nome: "LORENA FERREIRA FERNANDES", statusSuap: "Matriculado" },
    { mat: "20261031610046", nome: "Luíza santos de Souza", statusSuap: "Matriculado" },
    { mat: "20261031610012", nome: "MARCELI MOURA DOS SANTOS", statusSuap: "Matriculado" },
    { mat: "20261031610013", nome: "MARIA EDUARDA PESSANHA", statusSuap: "Matriculado" },
    { mat: "20261031610014", nome: "MARIA LIZZ TEIXEIRA", statusSuap: "Matriculado" },
    { mat: "20261031610036", nome: "PEROLA CANDIDO RIBEIRO DOS SANTOS", statusSuap: "Matriculado" },
    { mat: "20261031610035", nome: "Vallentyna Pereira Domingues Pinheiro", statusSuap: "Transferido" }
  ];

  console.log("=== COMPARANDO ALUNOS DA FOTO DO SUAP (1º ANO MANHÃ) COM NOSSO BANCO DE DADOS ===\n");

  const comparison: any[] = [];

  for (const s of suapList) {
    const res = await pool.query("SELECT id, matricula, nome_completo, turma_atual, turno, situacao, arquivo_morto FROM alunos WHERE matricula = $1 OR nome_completo ILIKE $2;", [s.mat, `%${s.nome}%`]);
    const dbItem = res.rows[0];

    comparison.push({
      matricula: s.mat,
      nomeSUAP: s.nome,
      statusSUAP: s.statusSuap,
      turmaNoBanco: dbItem ? dbItem.turma_atual : "Não cadastrado",
      turnoNoBanco: dbItem ? dbItem.turno : "-",
      situacaoNoBanco: dbItem ? dbItem.situacao : "-",
      arquivoMorto: dbItem ? dbItem.arquivo_morto : "-"
    });
  }

  console.table(comparison);

  await pool.end();
}

main();

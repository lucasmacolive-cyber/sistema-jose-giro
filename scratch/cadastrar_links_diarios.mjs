/**
 * Script para cadastrar os links dos diários do SUAP no banco de dados.
 * Execute com: node scratch/cadastrar_links_diarios.mjs
 */
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Links fornecidos pelo usuário (convertidos para o formato /edu/diario/ID/)
// NIT01 tem 3 diários (3º, 4º e 5º ano) — separados por \n no campo link_suap
const LINKS = [
  { nome: "P2T02", link: "https://suap.campos.rj.gov.br/edu/diario/61777/" },
  { nome: "P1T02", link: "https://suap.campos.rj.gov.br/edu/diario/61776/" },
  { nome: "P2M01", link: "https://suap.campos.rj.gov.br/edu/diario/61775/" },
  { nome: "P1M01", link: "https://suap.campos.rj.gov.br/edu/diario/61774/" },
  { nome: "G3M01", link: "https://suap.campos.rj.gov.br/edu/diario/61773/" },
  { nome: "G2T01", link: "https://suap.campos.rj.gov.br/edu/diario/61772/" },
  // NIT01: 3 diários (3º, 4º e 5º ano) separados por \n
  {
    nome: "NIT01",
    link: [
      "https://suap.campos.rj.gov.br/edu/diario/56343/", // 5º ano
      "https://suap.campos.rj.gov.br/edu/diario/56342/", // 4º ano
      "https://suap.campos.rj.gov.br/edu/diario/63350/", // 3º ano
    ].join("\n"),
  },
  { nome: "5AT01", link: "https://suap.campos.rj.gov.br/edu/diario/56286/" },
  { nome: "4AM01", link: "https://suap.campos.rj.gov.br/edu/diario/56285/" },
  { nome: "3AM01", link: "https://suap.campos.rj.gov.br/edu/diario/56284/" },
  { nome: "2AT02", link: "https://suap.campos.rj.gov.br/edu/diario/56283/" },
  { nome: "2AM01", link: "https://suap.campos.rj.gov.br/edu/diario/56269/" },
  { nome: "1AT02", link: "https://suap.campos.rj.gov.br/edu/diario/56255/" },
];

async function main() {
  console.log("=== Cadastrando links dos diários SUAP ===\n");

  // Buscar todas as turmas do banco
  const { rows: turmasDB } = await pool.query("SELECT id, nome_turma, link_suap FROM turmas ORDER BY nome_turma");
  console.log(`Turmas encontradas no banco: ${turmasDB.length}`);

  let atualizadas = 0;
  let novas = 0;
  let naoEncontradas = [];

  for (const item of LINKS) {
    // Buscar a turma pelo nome (case-insensitive)
    const turma = turmasDB.find(t =>
      t.nome_turma?.toLowerCase() === item.nome.toLowerCase()
    );

    if (!turma) {
      // Turma não existe — criar ela
      console.log(`  ⚠️  Turma "${item.nome}" não encontrada no banco. Criando...`);
      const turno = item.nome.includes("T0") ? "Tarde" : "Manhã";
      const { rows } = await pool.query(
        "INSERT INTO turmas (nome_turma, turno, link_suap) VALUES ($1, $2, $3) RETURNING id",
        [item.nome, turno, item.link]
      );
      console.log(`  ✅  Turma "${item.nome}" criada com ID ${rows[0].id}`);
      novas++;
    } else {
      // Turma existe — atualizar o link_suap
      await pool.query("UPDATE turmas SET link_suap = $1 WHERE id = $2", [item.link, turma.id]);
      const numLinks = item.link.split("\n").length;
      console.log(`  ✅  Turma "${item.nome}" (ID ${turma.id}) → ${numLinks} link(s) cadastrado(s)`);
      atualizadas++;
    }
  }

  // Mostrar turmas sem link
  const { rows: semLink } = await pool.query("SELECT nome_turma FROM turmas WHERE link_suap IS NULL OR link_suap = '' ORDER BY nome_turma");
  
  console.log(`\n=== Resultado ===`);
  console.log(`✅ ${atualizadas} turmas atualizadas | 🆕 ${novas} turmas criadas`);
  if (semLink.length > 0) {
    console.log(`⚠️  Turmas sem link (${semLink.length}): ${semLink.map(t => t.nome_turma).join(", ")}`);
  }
  console.log(`\nPronto! Clique em "Atualizar todos" na tela de Diários para sincronizar.`);

  await pool.end();
}

main().catch(e => {
  console.error("Erro:", e.message);
  process.exit(1);
});

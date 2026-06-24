// @ts-nocheck
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

const { Pool } = pg;
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("Inserindo comando de geração no banco para +5522981310965...");
  
  await pool.query("INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('whatsapp_command_generate', '5522981310965', NOW()) ON CONFLICT (chave) DO UPDATE SET valor = '5522981310965', atualizado_em = NOW()");
  await pool.query("INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('whatsapp_number', '5522981310965', NOW()) ON CONFLICT (chave) DO UPDATE SET valor = '5522981310965', atualizado_em = NOW()");
  
  console.log("Comando inserido! Aguardando 10 segundos para o robô processar e gerar o código...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  const res = await pool.query("SELECT chave, valor FROM configuracoes WHERE chave = 'whatsapp_pairing_code'");
  console.log("=== CÓDIGO DE PAREAMENTO NO BANCO ===");
  console.log(JSON.stringify(res.rows, null, 2));
  
  await pool.end();
}

main().catch(console.error);

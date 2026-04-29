import dotenv from "dotenv";
import path from "path";

// Carregar .env da raiz do monorepo IMEDIATAMENTE
dotenv.config({ path: path.join(process.cwd(), "..", "..", ".env") });

import app from "./app.js";
import { importarAlunosXLS } from "./services/importService.js";

const PORT = process.env.PORT || 8080;

async function setup() {
  // Importação dinâmica para garantir que o dotenv já tenha rodado
  const { db, usuariosTable, alunosTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  console.log("DATABASE_URL:", process.env.DATABASE_URL?.split("@")[1]);
  console.log("Verificando usuários do sistema...");
  try {
    const raw = await db.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'usuarios'");
    console.log("Colunas detectadas pelo Drizzle:", raw.rows.map(r => (r as any).column_name));
    
    const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.login, "admin")).limit(1);
    if (existing.length === 0) {
      await db.insert(usuariosTable).values({
        nomeCompleto: "Administrador Geral",
        login: "admin",
        senha: "admin", 
        perfil: "Master",
      });
      console.log("Usuário admin criado!");
    }

    const lucas = await db.select().from(usuariosTable).where(eq(usuariosTable.login, "lucas")).limit(1);
    if (lucas.length === 0) {
      await db.insert(usuariosTable).values({
        nomeCompleto: "Lucas Machado de Oliveira",
        login: "lucas",
        senha: "lucas",
        perfil: "Master",
      });
      console.log("Usuário lucas criado!");
    }
    // Garantir coluna impressora_nome na tabela impressoes
    try {
      console.log("Verificando colunas da tabela impressoes...");
      await db.execute("ALTER TABLE impressoes ADD COLUMN IF NOT EXISTS impressora_nome varchar(50)");
      console.log("Tabela impressoes atualizada!");
    } catch (err) {
      console.error("Erro ao atualizar tabela impressoes:", err);
    }
  } catch (err) {
    console.error("Erro no setup do sistema:", err);
  }

  // Auto-importação se habilitada
  const xlsPath = path.join(process.cwd(), "..", "..", "attached_assets", "Relatorio.xls");
  if (process.env.AUTO_IMPORT === "true") {
     console.log("Iniciando auto-importação do SUAP...");
     importarAlunosXLS(xlsPath).then(res => console.log("Importação concluída!", res)).catch(console.error);
  }
}

// Chamar setup uma vez na inicialização do arquivo
setup().catch(console.error);

// Exportar para o Vercel
export default app;

// Iniciar servidor apenas se rodando localmente (não no Vercel)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando localmente em http://localhost:${PORT}`);
  });
}


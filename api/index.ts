// @ts-nocheck
import dotenv from "dotenv";
import path from "path";

// Carregar .env IMEDIATAMENTE
dotenv.config();

import app from "./app.js";
// @ts-ignore
import * as dbModule from "./lib/db/index.ts";
const { db, usuariosTable, usuarios } = dbModule as any;
import { eq } from "drizzle-orm";

// Usar o que estiver disponível
const table = usuariosTable || usuarios;

const PORT = process.env.PORT || 8080;

async function setup() {
  console.log("Verificando usuários do sistema...");
  try {
    // @ts-ignore - Suprimir erro de tipo temporariamente para deploy
    const existing = await db.select().from(table).where(eq(table.login, "admin")).limit(1);
    if (existing.length === 0) {
      // @ts-ignore
      await db.insert(table).values({
        nomeCompleto: "Administrador Geral",
        login: "admin",
        senha: "admin", 
        perfil: "Master",
      });
      console.log("Usuário admin criado!");
    }

    // @ts-ignore
    const lucas = await db.select().from(table).where(eq(table.login, "lucas")).limit(1);
    if (lucas.length === 0) {
      // @ts-ignore
      await db.insert(table).values({
        nomeCompleto: "Lucas Machado de Oliveira",
        login: "lucas",
        senha: "lucas",
        perfil: "Master",
      });
      console.log("Usuário lucas criado!");
    }
  } catch (err) {
    console.error("Erro no setup do sistema:", err);
  }
}

// Chamar setup
setup().catch(console.error);

// Exportar para o Vercel
export default app;

// Iniciar servidor apenas se rodando localmente
if (process.env.NODE_ENV !== "production") {
  (app as any).listen(PORT, () => {
    console.log(`🚀 Servidor rodando localmente em http://localhost:${PORT}`);
  });
}

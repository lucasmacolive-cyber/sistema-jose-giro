// @ts-nocheck
import dotenv from "dotenv";
import path from "path";

// Carregar .env IMEDIATAMENTE
dotenv.config();

import app from "./app.js";
// @ts-ignore
import * as dbModule from "./lib/db/index.js";
const { db, usuariosTable, usuarios, configuracoesTable } = dbModule as any;
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

    // Se rodando localmente e o servidor reiniciou no meio de um batch sync, libera o estado preso
    if (process.env.NODE_ENV !== "production" && configuracoesTable) {
      const [row] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "batch_sync_state")).limit(1);
      if (row?.valor) {
        try {
          const st = JSON.parse(row.valor);
          if (st?.rodando && st?.msg !== "Acionando o Robô Escolar local na escola...") {
            const interrupted = {
              ...st,
              rodando: false,
              concluido: true,
              erro: "Servidor local reiniciou durante a sincronização.",
              mensagem: "Servidor local reiniciou durante a sincronização.",
              msg: "Servidor local reiniciou durante a sincronização.",
            };
            await db.insert(configuracoesTable)
              .values({ chave: "batch_sync_state", valor: JSON.stringify(interrupted), atualizadoEm: new Date() })
              .onConflictDoUpdate({
                target: configuracoesTable.chave,
                set: { valor: JSON.stringify(interrupted), atualizadoEm: new Date() },
              });
            console.log("[Startup] Estado de batch_sync_state preso após reinício foi liberado.");
          }
        } catch {}
      }
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

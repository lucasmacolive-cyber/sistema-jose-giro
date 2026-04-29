import "dotenv/config";
import { db, usuarios } from "../lib/db/src/index";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Criando usuário Master...");
  try {
    const existing = await db.select().from(usuarios).where(eq(usuarios.login, "admin")).limit(1);
    if (existing.length === 0) {
      await db.insert(usuarios).values({
        nomeCompleto: "Administrador Geral",
        login: "admin",
        senha: "admin", // Recomendado usar hash em produção
        perfil: "Master",
      });
      console.log("Usuário admin criado com sucesso!");
    } else {
      console.log("Usuário admin já existe.");
    }
    process.exit(0);
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    process.exit(1);
  }
}

run();

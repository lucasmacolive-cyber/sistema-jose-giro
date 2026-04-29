// @ts-nocheck
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import dotenv from "dotenv";
import path from "path";

// Tentar carregar .env de vários lugares possíveis
dotenv.config(); // CWD
dotenv.config({ path: "../../.env" }); // lib/db -> root
dotenv.config({ path: path.join(process.cwd(), "..", "..", ".env") }); // artifacts/api-server -> root

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Se não estiver no .env, não trava agora, mas o pool vai falhar se usado
  console.warn("DATABASE_URL not found in environment.");
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Necessário para Neon
});

export const db = drizzle(pool, { schema });

export * from "./schema/index.js";

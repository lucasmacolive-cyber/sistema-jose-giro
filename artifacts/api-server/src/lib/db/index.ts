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
  ssl: { rejectUnauthorized: false }, // Necessário para Neon
  max: 10,
  idleTimeoutMillis: 20000, // Fecha conexões ociosas antes do Neon encerrar o socket
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client in pool:", err);
});

const TRANSIENT_DB_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
]);

export function isTransientDbError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || err.cause?.code || "").toUpperCase();
  if (TRANSIENT_DB_CODES.has(code)) return true;
  const msg = `${err.message || ""} ${err.cause?.message || ""}`.toLowerCase();
  return (
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("epipe") ||
    msg.includes("socket hang up") ||
    msg.includes("connection terminated") ||
    msg.includes("connection closed") ||
    msg.includes("timeout expired")
  );
}

export function formatDbError(err: any): string {
  if (!err) return "Erro desconhecido";
  const causeMsg = err.cause?.message || err.cause?.code;
  const rawMsg = String(err.message || err);
  if (rawMsg.startsWith("Failed query:") && causeMsg) {
    return `Erro de conexão com o banco (${causeMsg})`;
  }
  if (rawMsg.length > 260) {
    return causeMsg ? `${rawMsg.slice(0, 180)}... (${causeMsg})` : `${rawMsg.slice(0, 220)}...`;
  }
  return rawMsg;
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  label = "db-op",
  maxAttempts = 4
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 400 * attempt;
      console.warn(`[DB Retry] ${label} falhou (tentativa ${attempt}/${maxAttempts}): ${formatDbError(err)}. Tentando em ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export const db = drizzle(pool, { schema });

export * from "./schema/index.js";

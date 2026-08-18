import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.join(process.cwd(), ".env") });

import { sincronizarSUAP } from "../api/lib/suapSync.ts";

async function inspectForm() {
  const usuario = process.env.SUAP_USUARIO ?? "21501";
  const senha = process.env.SUAP_SENHA ?? "12314569733";

  try {
    await sincronizarSUAP(usuario, senha, (pct, msg) => console.log(`[${pct}%] ${msg}`));
  } catch (err: any) {
    console.log("Captured error during sync:", err.message);
  }
}

inspectForm();

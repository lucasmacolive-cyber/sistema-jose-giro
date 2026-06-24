import "dotenv/config";
import { db } from "../lib/db/src/index.js";
import { configuracoesTable } from "../lib/db/src/schema/configuracoes.js";
import { eq } from "drizzle-orm";
import * as https from "https";
import * as http from "http";

const SUAP_HOST = "suap.campos.rj.gov.br";
const SUAP_BASE = `https://${SUAP_HOST}`;

class CookieJar {
  private jar: Record<string, string> = {};
  set(setCookieHeaders: string[] | undefined) {
    if (!setCookieHeaders) return;
    for (const c of setCookieHeaders) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) {
        this.jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
      }
    }
  }
  header(): string {
    return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get(name: string) { return this.jar[name]; }
}

function request(method: string, path: string, jar: CookieJar, body?: string, extraHeaders?: Record<string, string>): Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body, "utf8") : undefined;
    const options: https.RequestOptions = {
      hostname: SUAP_HOST,
      path,
      method,
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cookie": jar.header(),
        ...(bodyBuf ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(bodyBuf.length) } : {}),
        ...(extraHeaders || {})
      }
    };
    const req = https.request(options, (res) => {
      jar.set(res.headers["set-cookie"]);
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, text: Buffer.concat(chunks).toString("utf8"), headers: res.headers });
      });
    });
    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

async function main() {
  console.log("=== DIAGNÓSTICO DO SUAP ===");
  
  // Get credentials from DB
  const [uRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_usuario"));
  const [sRow] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "suap_senha"));
  const user = uRow?.valor || process.env.SUAP_USUARIO;
  const pass = sRow?.valor || process.env.SUAP_SENHA;

  if (!user || !pass) {
    console.error("Credenciais não configuradas!");
    process.exit(1);
  }

  const jar = new CookieJar();
  console.log(`Usando login: ${user}`);
  
  // 1. GET login page
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrf = loginGet.text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || jar.get("csrftoken") || "";
  console.log(`CSRF Token obtido: ${csrf}`);

  if (!csrf) {
    console.error("CSRF não encontrado!");
    process.exit(1);
  }

  // 2. POST login credentials
  const loginBody = new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    this_is_the_login_form: "1",
    next: "/",
    username: user,
    password: pass,
  }).toString();

  const loginResp = await request("POST", "/accounts/login/", jar, loginBody, { Referer: `${SUAP_BASE}/accounts/login/` });
  console.log(`Status de Login: ${loginResp.status}`);
  console.log(`Redirecionamento (Location): ${loginResp.headers.location}`);
  
  const isOk = loginResp.status === 302 || !loginResp.text.includes("accounts/login");
  console.log(`Login concluído? ${isOk}`);

  if (!isOk) {
    console.error("Falha na autenticação do SUAP!");
    process.exit(1);
  }

  // 3. Acessar Relatório
  console.log("Acessando página do relatório...");
  const SUAP_RELATORIO_URL = "/edu/relatorio/?uo=205&formatacao=simples&quantidade_itens=25&ordenacao=Nome&agrupamento=Campus&exibicao=ano_letivo&exibicao=pessoa_fisica.cpf&exibicao=nome_mae&exibicao=nome_pai&exibicao=pessoa_fisica.nascimento_data&exibicao=turma_ano_consulta&relatorio_form=Pesquisar";
  const rep = await request("GET", SUAP_RELATORIO_URL, jar);
  console.log(`Status do Relatório: ${rep.status}`);
  const fs = require("fs");
  fs.writeFileSync("scratch/report_page.html", rep.text);
  console.log("Salvo scratch/report_page.html");

  // 4. Solicitar XLS via POST
  console.log("Solicitando geração do arquivo XLS via POST...");
  const reportCsrf = rep.text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || jar.get("__Host-csrftoken") || jar.get("csrftoken") || "";
  console.log(`CSRF para exportação: ${reportCsrf}`);

  const exportBody = new URLSearchParams();
  exportBody.append("csrfmiddlewaretoken", reportCsrf);
  exportBody.append("xls", "1");

  const exp = await request("POST", SUAP_RELATORIO_URL + "&xls=1", jar, exportBody.toString(), {
    Referer: `${SUAP_BASE}${SUAP_RELATORIO_URL}`,
    "X-CSRFToken": reportCsrf
  });
  console.log(`Status exportação: ${exp.status}`);
  console.log(`Headers exportação: ${JSON.stringify(exp.headers)}`);
  fs.writeFileSync("scratch/export_page.html", exp.text);
  console.log("Salvo scratch/export_page.html");

  process.exit(0);
}

main().catch(console.error);

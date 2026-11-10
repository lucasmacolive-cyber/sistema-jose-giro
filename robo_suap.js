require("dotenv").config();
const { Pool } = require("pg");
const https = require("https");
const fs = require("fs");
const path = require("path");

const VERCEL_URL = "https://sistema-jose-giro-escola.vercel.app";
const SUAP_HOST = "suap.campos.rj.gov.br";
const SUAP_BASE = `https://${SUAP_HOST}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

class CookieJar {
  constructor() {
    this.jar = {};
  }
  set(setCookieHeaders) {
    if (!setCookieHeaders) return;
    for (const c of setCookieHeaders) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) {
        const k = kv.slice(0, eq).trim();
        const v = kv.slice(eq + 1).trim();
        this.jar[k] = v;
      }
    }
  }
  header() {
    return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get(name) {
    return this.jar[name];
  }
}

function request(method, pathUrl, jar, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body, "utf8") : undefined;
    const options = {
      hostname: SUAP_HOST,
      path: pathUrl,
      method,
      timeout: 120000, // 2 mins timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Cookie": jar.header(),
        ...(bodyBuf ? { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": String(bodyBuf.length) } : {}),
        ...(extraHeaders || {}),
      },
    };

    const req = https.request(options, (res) => {
      jar.set(res.headers["set-cookie"]);
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode || 0, headers: res.headers, body: buf, text: buf.toString("utf8") });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout de conexão")); });
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function extractCsrf(html, jar) {
  const fromHtml = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] ||
                   html.match(/csrfmiddlewaretoken[^>]+value="([^"]+)"/)?.[1];
  if (fromHtml) return fromHtml;
  return jar.get("__Host-csrftoken") || jar.get("csrftoken") || "";
}

function isXlsBuffer(body, contentType) {
  return (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType.includes("octet-stream") ||
    body.slice(0, 4).toString("hex") === "d0cf11e0" ||
    body.slice(0, 4).toString() === "PK\x03\x04"
  );
}

function encontrarLinkExport(html) {
  const allLinks = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const byHref = allLinks.find((h) => {
    const l = h.toLowerCase();
    return (l.includes("export") && l.includes("xls")) || l.includes("formato=xls") || l.includes("gerar_arquivo");
  });
  if (byHref) return byHref;
  const byText = html.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*[Ee]xportar[^<]*[Xx][Ll][Ss][^<]*<\/a>/)?.[1];
  if (byText) return byText;
  const byXlsHref = allLinks.find((h) => h.toLowerCase().endsWith(".xls") || h.toLowerCase().includes(".xls?"));
  if (byXlsHref) return byXlsHref;
  return null;
}

function encontrarLinkDownload(html) {
  const allLinks = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const byXls = allLinks.find((h) => h.toLowerCase().includes(".xls"));
  if (byXls) return byXls;
  const byDl = allLinks.find((h) => h.toLowerCase().includes("download") || h.toLowerCase().includes("arquivo") || h.toLowerCase().includes("continuar"));
  if (byDl) return byDl;
  const byText = html.match(/<a[^>]+href="([^"]+)"[^>]*>[^<]*(baixar|download|clique aqui|aqui|arquivo)[^<]*<\/a>/i)?.[1];
  if (byText) return byText;
  return null;
}

function encontrarMetaRefresh(html) {
  const m = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s]+)/i);
  if (m) return m[1];
  const m2 = html.match(/<meta[^>]+content=["'][^"']*url=([^"'\s]+)[^"']*["'][^>]+http-equiv=["']refresh["']/i);
  if (m2) return m2[1];
  return null;
}

function resolverPath(href) {
  if (!href) return href;
  if (href.startsWith("http")) {
    try { return new URL(href).pathname + new URL(href).search; } catch { return href; }
  }
  return href;
}

async function suapLogin(usuario, senha) {
  const jar = new CookieJar();
  console.log("[Robo SUAP] Abrindo página de login do SUAP...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrf = extractCsrf(loginGet.text, jar);
  if (!csrf) throw new Error("Não foi possível obter token CSRF do SUAP.");

  console.log("[Robo SUAP] Autenticando...");
  const loginResp = await request("POST", "/accounts/login/", jar, new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    this_is_the_login_form: "1",
    next: "/",
    username: usuario,
    password: senha,
  }).toString(), { Referer: `${SUAP_BASE}/accounts/login/` });

  if (loginResp.text.includes("accounts/login") && loginResp.status !== 302) {
    throw new Error("Falha no login do SUAP. Verifique as credenciais.");
  }
  return jar;
}

async function sincronizarSUAP(jar) {
  console.log("[Robo SUAP] Acessando lista de alunos...");
  const page1 = await request("GET", "/edu/aluno/", jar);

  let exportLink = encontrarLinkExport(page1.text);

  if (!exportLink && page1.text.includes("Meus Relatórios")) {
    console.log("[Robo SUAP] Tentando via Relatórios Personalizados...");
    const rels = await request("GET", "/edu/relatorio/", jar);
    
    let urlAlunos = null;
    const regexRel = /<a[^>]+href="([^"]+)"[^>]*>[^<]*(Alunos|Relat.rio de Alunos)[^<]*<\/a>/gi;
    let m;
    while ((m = regexRel.exec(rels.text)) !== null) {
      if (!m[1].includes("delete") && !m[1].includes("update")) {
        urlAlunos = m[1];
        break;
      }
    }
    
    if (!urlAlunos) {
      const allLinks = [...rels.text.matchAll(/href="(\/edu\/relatorio\/\d+\/)"/g)].map(x => x[1]);
      if (allLinks.length > 0) urlAlunos = allLinks[0];
    }

    if (urlAlunos) {
      console.log(`[Robo SUAP] Acessando relatório: ${urlAlunos}`);
      const relPage = await request("GET", urlAlunos, jar);
      exportLink = encontrarLinkExport(relPage.text);
    }
  }

  if (!exportLink) {
    throw new Error("Não foi possível encontrar o link para exportar XLS.");
  }

  console.log(`[Robo SUAP] Solicitando exportação XLS: ${exportLink}`);
  let currentUrl = resolverPath(exportLink);
  let attempts = 0;
  
  while (attempts < 10) {
    attempts++;
    const resp = await request("GET", currentUrl, jar);
    
    if (isXlsBuffer(resp.body, resp.headers["content-type"] || "")) {
      return resp.body; // Retorna o buffer XLS
    }
    
    const refreshUrl = encontrarMetaRefresh(resp.text);
    if (refreshUrl) {
      currentUrl = resolverPath(refreshUrl);
      console.log(`[Robo SUAP] Redirecionamento Meta Refresh para: ${currentUrl}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    const dlLink = encontrarLinkDownload(resp.text);
    if (dlLink) {
      currentUrl = resolverPath(dlLink);
      console.log(`[Robo SUAP] Link de download direto encontrado: ${currentUrl}`);
      continue;
    }
    
    break;
  }

  // Se for página de "Tarefa Assíncrona" (/tarefa/1234/)
  if (currentUrl.includes("/tarefa/")) {
    const taskIdMatch = currentUrl.match(/\/tarefa\/([a-zA-Z0-9-]+)/);
    if (taskIdMatch) {
      console.log(`[Robo SUAP] Tarefa assíncrona detectada: ${taskIdMatch[1]}`);
      return await aguardarTarefaAssincrona(jar, taskIdMatch[1], currentUrl);
    }
  }

  throw new Error("Não foi possível baixar o XLS (formato desconhecido ou falha na exportação).");
}

async function aguardarTarefaAssincrona(jar, taskId, baseUrl) {
  const checkUrl = `/tarefa/status/${taskId}/`;
  let tentativas = 0;
  const maxTentativas = 60; // 60 * 20s = 20 mins

  while (tentativas < maxTentativas) {
    tentativas++;
    await new Promise(r => setTimeout(r, 20000)); // Espera 20s

    console.log(`[Robo SUAP] Checando status da tarefa... (tentativa ${tentativas})`);
    const statusResp = await request("GET", checkUrl, jar);
    const statusText = statusResp.text;

    if (isXlsBuffer(statusResp.body, statusResp.headers["content-type"] || "")) {
      return statusResp.body;
    }

    const tokens = statusText.split("::");
    const percentual = tokens[0] || "";
    const message = tokens[1] || "";
    const file = tokens[2] || "";
    const urlToken = tokens[3] || "";

    console.log(`[Robo SUAP]   → Progresso: ${percentual}% | Mensagem: "${message.slice(0,60)}"`);

    if (message && message.trim().length > 0) {
      let downloadUrl = file ? `/tarefa/download/${file}/` : (urlToken && urlToken !== ".." ? resolverPath(urlToken) : baseUrl);
      console.log(`[Robo SUAP] ✓ Tarefa concluída! Baixando arquivo via ${downloadUrl}`);
      
      const dlResp = await request("GET", downloadUrl, jar, undefined, {
        Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
      });
      if (isXlsBuffer(dlResp.body, dlResp.headers["content-type"] || "") || dlResp.body.length > 5000) {
        return dlResp.body;
      }
      
      if (urlToken && urlToken !== ".." && urlToken.length > 5) {
        const altResp = await request("GET", resolverPath(urlToken), jar, undefined, {
          Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
        });
        if (altResp.body.length > 5000) return altResp.body;
      }
      throw new Error("Tarefa concluída mas o arquivo não foi encontrado.");
    }
  }
  throw new Error("Timeout: o SUAP não concluiu a exportação XLS.");
}

async function uploadAlunosToVercel(xlsBuffer) {
  return new Promise((resolve, reject) => {
    const base64 = xlsBuffer.toString("base64");
    const payload = JSON.stringify({ arquivo: base64, substituirTudo: true });

    const options = {
      hostname: "sistema-jose-giro-escola.vercel.app",
      path: "/api/sync/upload-alunos",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    console.log("[Robo SUAP] Enviando arquivo de alunos para Vercel...");
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function uploadDiarioToVercel(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const base64 = pdfBuffer.toString("base64");
    const payload = JSON.stringify({ arquivo: base64 });

    const options = {
      hostname: "sistema-jose-giro-escola.vercel.app",
      path: "/api/sync/diario-pdf",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function uploadBoletimToVercel(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const base64 = pdfBuffer.toString("base64");
    const payload = JSON.stringify({ arquivo: base64 });

    const options = {
      hostname: "sistema-jose-giro-escola.vercel.app",
      path: "/api/sync/boletim-pdf",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ==========================================
// NOVA FUNÇÃO: SINCRONIZAR DIÁRIOS E BOLETINS PDFs
// ==========================================
async function sincronizarDiarios(jar) {
  console.log("[Robo SUAP] Buscando lista de diários do SUAP...");
  const urlsParaTentar = [
    "/admin/edu/diario/?ano_letivo__id__exact=9&all=",
    "/admin/edu/diario/?ano_letivo__id__exact=9",
    "/edu/meus_diarios/",
    "/edu/diarios/?ano_letivo=9",
    "/edu/diarios/",
    "/edu/meu_diario/",
  ];
  
  let htmlLista = "";
  for (const url of urlsParaTentar) {
    const resp = await request("GET", url, jar);
    if (resp.status === 200 && !resp.text.toLowerCase().includes("this_is_the_login_form")) {
      const mCheck = resp.text.match(/\/edu\/diario(?:_pdf)?\/(\d+)\//);
      if (mCheck) {
        htmlLista = resp.text;
        console.log(`[Robo SUAP] Lista de diários obtida em: ${url}`);
        break;
      }
    }
  }

  if (!htmlLista) {
    console.log("[Robo SUAP] Nenhum diário encontrado ou página não acessível.");
    return;
  }

  // Usar RegExp simples para encontrar todos os IDs de diários
  const regex = /\/edu\/diario(?:_pdf)?\/(\d+)\//g;
  const idsVistos = new Set();
  let match;
  
  while ((match = regex.exec(htmlLista)) !== null) {
    idsVistos.add(match[1]);
  }

  const diarios = Array.from(idsVistos);
  console.log(`[Robo SUAP] Foram encontrados ${diarios.length} diários no SUAP.`);

  // Para cada diário, baixar o PDF de presenças + PDF de boletim e enviar para a API da Vercel
  for (let i = 0; i < diarios.length; i++) {
    const id = diarios[i];
    console.log(`[Robo SUAP] Baixando PDF do diário ${id} (${i + 1}/${diarios.length})...`);
    try {
      const pdfResp = await request("GET", `/edu/diario_pdf/${id}/0/`, jar);
      if (pdfResp.status === 200 && pdfResp.body.length > 1000) {
        console.log(`[Robo SUAP] PDF ${id} baixado! Enviando para o sistema...`);
        const result = await uploadDiarioToVercel(pdfResp.body);
        try {
          const js = JSON.parse(result);
          if (js.ok) {
            console.log(`[Robo SUAP] ✓ Diário ${id} sincronizado com sucesso!`);
          } else {
            console.log(`[Robo SUAP] ⚠️ Erro da API ao sincronizar diário ${id}:`, js.mensagem);
          }
        } catch(e) {
          console.log(`[Robo SUAP] ⚠️ Resposta da API não parseável para diário ${id}:`, result.slice(0, 100));
        }
      } else {
        console.log(`[Robo SUAP] ⚠️ Falha ao baixar PDF ${id} (Status ${pdfResp.status}).`);
      }

      // Também baixar o Boletim de Notas e Faltas (/edu/emitir_boletins_pdf/{id}/)
      const bolResp = await request("GET", `/edu/emitir_boletins_pdf/${id}/`, jar);
      if (bolResp.status === 200 && bolResp.body.length > 500) {
        await uploadBoletimToVercel(bolResp.body);
        console.log(`[Robo SUAP] ✓ Boletim de notas/faltas ${id} sincronizado!`);
      }
    } catch(e) {
      console.log(`[Robo SUAP] ⚠️ Erro ao processar diário ${id}:`, e.message);
    }
    // Aguarda 500ms entre PDFs para não sobrecarregar
    await new Promise(r => setTimeout(r, 500));
  }
}

async function runAutoSync() {
  try {
    console.log("=========================================");
    console.log("[Robo SUAP] Iniciando sincronização automática...");
    
    const { rows } = await pool.query("SELECT chave, valor FROM configuracoes WHERE chave IN ('suap_usuario', 'suap_senha')");
    let usuario = "", senha = "";
    rows.forEach(r => {
      if (r.chave === "suap_usuario") usuario = r.valor;
      if (r.chave === "suap_senha") senha = r.valor;
    });

    if (!usuario || !senha) {
      console.error("[Robo SUAP] Credenciais não configuradas no banco de dados.");
      return;
    }

    // 1. Fazer Login
    const jar = await suapLogin(usuario, senha);
    console.log("[Robo SUAP] ✓ Autenticado no SUAP!");

    // 2. Sincronizar Alunos (XLS)
    try {
      const xlsBuffer = await sincronizarSUAP(jar);
      console.log("[Robo SUAP] XLS baixado com sucesso! Tamanho:", xlsBuffer.length, "bytes");
      const result = await uploadAlunosToVercel(xlsBuffer);
      console.log("[Robo SUAP] Sincronização de alunos:", result);
    } catch(e) {
      console.error("[Robo SUAP] ❌ Erro ao sincronizar Alunos (XLS):", e.message);
    }

    // 3. Sincronizar Diários (PDFs)
    try {
      await sincronizarDiarios(jar);
    } catch(e) {
      console.error("[Robo SUAP] ❌ Erro ao sincronizar Diários (PDFs):", e.message);
    }

    console.log("[Robo SUAP] ✓ Ciclo de sincronização concluído!");
  } catch (err) {
    console.error("[Robo SUAP] Erro geral na sincronização:", err.message);
  }
}

// Executar a cada 2 horas (7200000 ms)
const DUAS_HORAS = 2 * 60 * 60 * 1000;
setInterval(runAutoSync, DUAS_HORAS);

// Executa na inicialização
runAutoSync();

console.log("Robo SUAP rodando. Sincronizará a cada 2 horas.");

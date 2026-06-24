require("dotenv").config();
const { Pool } = require("pg");
const https = require("https");

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

function request(method, path, jar, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body, "utf8") : undefined;
    const options = {
      hostname: SUAP_HOST,
      path,
      method,
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
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

  // Prioridade 1: link com .xls no href
  const byXls = allLinks.find((h) => h.toLowerCase().includes(".xls"));
  if (byXls) return byXls;

  // Prioridade 2: link de download do djtools ou padrões do SUAP
  const byDjtools = allLinks.find((h) => {
    const l = h.toLowerCase();
    return l.includes("/djtools/download/") || l.includes("/djtools/files/") || l.includes("/djtools/result/");
  });
  if (byDjtools) return byDjtools;

  // Prioridade 3: link genérico com "download" ou "arquivo" ou "continuar"
  const byDl = allLinks.find((h) => {
    const l = h.toLowerCase();
    return l.includes("download") || l.includes("arquivo") || l.includes("continuar");
  });
  if (byDl) return byDl;

  // Prioridade 4: link com texto "baixar", "download", "aqui", etc.
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const SUAP_RELATORIO_URL =
  "/edu/relatorio/?uo=205&diretoria=&estrutura_curso=&modalidade=&convenio=&polo=" +
  "&ano_letivo=&periodo_letivo=0&periodo_matriz=0&periodo_referencia=0&ano_conclusao=" +
  "&situacao_diario=0&turno=&situacao_matricula=&situacao_matricula_periodo=" +
  "&ano_ingresso_inicio=&periodo_ingresso_inicio=0&ano_ingresso_fim=&periodo_ingresso_fim=0" +
  "&aluno_especial=&forma_ingresso=&situacao_sistema=TODOS&medida_disciplinar=0" +
  "&percentual_conclusao_curso_inicial=&percentual_conclusao_curso_final=" +
  "&tipo_necessidade_especial=0&tipo_transtorno=0&superdotacao=0&pendencias=" +
  "&formatacao=simples&quantidade_itens=25&ordenacao=Nome&agrupamento=Campus" +
  "&exibicao=ano_letivo_integralizacao&exibicao=ano_let_prev_conclusao&exibicao=ano_conclusao" +
  "&exibicao=ano_letivo&exibicao=pessoa_fisica.cpf&exibicao=cpf_responsavel" +
  "&exibicao=curso_campus.diretoria.setor.uo&exibicao=get_chave_responsavel" +
  "&exibicao=cidade.nome&exibicao=convenio&exibicao=cota_mec&exibicao=cota_sistec" +
  "&exibicao=curso_campus.codigo&exibicao=codigo_educacenso" +
  "&exibicao=get_projeto_final_aprovado.data_defesa&exibicao=dt_conclusao_curso" +
  "&exibicao=data_conclusao_intercambio&exibicao=data_integralizacao&exibicao=data_matricula" +
  "&exibicao=pessoa_fisica.nascimento_data&exibicao=get_data_ultimo_procedimento_periodo_referencia" +
  "&exibicao=get_tipo_necessidade_especial_display&exibicao=curso_campus.descricao" +
  "&exibicao=curso_campus.diretoria&exibicao=candidato_vaga.candidato.edital" +
  "&exibicao=pessoa_fisica.email&exibicao=email_google_classroom" +
  "&exibicao=pessoa_fisica.email_secundario&exibicao=email_responsavel" +
  "&exibicao=get_endereco&exibicao=cidade.estado.get_sigla&exibicao=estado_civil" +
  "&exibicao=pessoa_fisica.raca&exibicao=forma_ingresso" +
  "&exibicao=get_frequencia_periodo_referencia&exibicao=ira&exibicao=matriz" +
  "&exibicao=curso_campus.modalidade&exibicao=cidade&exibicao=cidade.codigo" +
  "&exibicao=nacionalidade&exibicao=naturalidade&exibicao=naturalidade.codigo" +
  "&exibicao=curso_campus.natureza_participacao&exibicao=nome_mae&exibicao=nome_pai" +
  "&exibicao=numero_pasta&exibicao=curso_campus.modalidade.nivel_ensino" +
  "&exibicao=observacao_historico&exibicao=get_observacoes&exibicao=pais_origem" +
  "&exibicao=pendencias&exibicao=percentual_ch_cumprida&exibicao=periodo_atual" +
  "&exibicao=periodo_letivo_integralizacao&exibicao=periodo_letivo&exibicao=periodo_ano_consulta" +
  "&exibicao=polo&exibicao=get_rg&exibicao=caracterizacao.renda_per_capita&exibicao=responsavel" +
  "&exibicao=pessoa_fisica.sexo&exibicao=situacao_ano_consulta&exibicao=situacao" +
  "&exibicao=get_situacao_periodo_referencia&exibicao=get_superdotacao_display" +
  "&exibicao=get_telefones&exibicao=tipo_instituicao_origem" +
  "&exibicao=get_poder_publico_responsavel_transporte_display&exibicao=get_tipo_veiculo_display" +
  "&exibicao=get_tipo_transtorno_display&exibicao=get_ultima_matricula_periodo.turma" +
  "&exibicao=turma_ano_consulta&exibicao=turno&exibicao=get_tipo_zona_residencial_display" +
  "&relatorio_form=Aguarde...";

async function sincronizarSUAP(usuario, senha) {
  const jar = new CookieJar();
  console.log("[Robo SUAP] Abrindo página de login...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrfLogin = extractCsrf(loginGet.text, jar);

  if (!csrfLogin) throw new Error("Não foi possível obter token CSRF do SUAP.");

  console.log("[Robo SUAP] Autenticando...");
  const loginBody = new URLSearchParams({
    csrfmiddlewaretoken: csrfLogin,
    this_is_the_login_form: "1",
    next: "/",
    username: usuario,
    password: senha,
  }).toString();

  const loginResp = await request("POST", "/accounts/login/", jar, loginBody, { Referer: `${SUAP_BASE}/accounts/login/` });

  if (loginResp.text.includes("accounts/login") && loginResp.status !== 302) {
    throw new Error("Falha no login do SUAP. Credenciais inválidas.");
  }

  console.log("[Robo SUAP] Login ok. Acessando relatório...");
  const reportResp = await request("GET", SUAP_RELATORIO_URL, jar, undefined, { Referer: `${SUAP_BASE}/edu/relatorio/` });

  console.log("[Robo SUAP] Solicitando geração do arquivo XLS via POST...");
  const reportCsrf = extractCsrf(reportResp.text, jar);
  const exportBody = new URLSearchParams({
    csrfmiddlewaretoken: reportCsrf,
    xls: "1",
  }).toString();

  const exportResp = await request("POST", SUAP_RELATORIO_URL + "&xls=1", jar, exportBody, {
    Referer: `${SUAP_BASE}${SUAP_RELATORIO_URL}`,
    "X-CSRFToken": reportCsrf,
    Accept: "application/vnd.ms-excel,application/octet-stream,text/html,*/*",
  });

  const ct = exportResp.headers["content-type"] || "";
  if (isXlsBuffer(exportResp.body, ct)) {
    console.log("[Robo SUAP] ✓ Arquivo XLS recebido diretamente!");
    return exportResp.body;
  }

  // ── Detectar UUID da tarefa do djtools ─────────────────────────────────────
  // O SUAP redireciona para /djtools/process2/{UUID}/ e emite JavaScript com
  //   $.get("/djtools/process_progress2/0/{UUID}/", ...)
  // Precisamos extrair o UUID para usar a API de polling
  let taskUuid = null;
  let process2Html = exportResp.text;

  // Tentar extrair UUID diretamente da resposta do POST
  let uuidMatch = process2Html.match(/\/djtools\/process(?:_progress)?2\/(?:0\/)?([a-f0-9-]{36})\//i);
  
  // Se não encontrou, seguir redirect para página /djtools/process2/...
  if (!uuidMatch) {
    let followPath = null;
    if (exportResp.headers.location) {
      followPath = resolverPath(exportResp.headers.location);
    } else {
      const metaUrl = encontrarMetaRefresh(exportResp.text);
      if (metaUrl) followPath = resolverPath(metaUrl);
    }
    
    if (followPath) {
      console.log(`[Robo SUAP] Seguindo redirect para: ${followPath}`);
      const followResp = await request("GET", followPath, jar);
      process2Html = followResp.text;
      
      // Verificar se já é XLS
      const fct = followResp.headers["content-type"] || "";
      if (isXlsBuffer(followResp.body, fct)) return followResp.body;
      
      uuidMatch = process2Html.match(/\/djtools\/process(?:_progress)?2\/(?:0\/)?([a-f0-9-]{36})\//i);
    }
  }

  if (!uuidMatch) {
    throw new Error("Não foi possível detectar o UUID da tarefa de geração do relatório SUAP. Estrutura inesperada.");
  }

  taskUuid = uuidMatch[1];
  console.log(`[Robo SUAP] Tarefa detectada! UUID: ${taskUuid}`);
  console.log("[Robo SUAP] Usando API djtools/process_progress2 para monitorar conclusão...");

  // ── Polling via API AJAX do SUAP ───────────────────────────────────────────
  // A API retorna: "percentual::message::file::url"
  //   - Enquanto processa: "75:::: " (message vazio, file vazio)
  //   - Quando conclui:    "100::Relatório gerado com sucesso.::1::url_ou_vazio"
  //   - Se file != "": baixar via /djtools/process_progress2/1/{UUID}/
  const statusUrl = `/djtools/process_progress2/0/${taskUuid}/`;
  const downloadUrl = `/djtools/process_progress2/1/${taskUuid}/`;

  for (let tentativa = 0; tentativa < 240; tentativa++) {
    await sleep(5000);
    
    console.log(`[Robo SUAP] Poll ${tentativa+1}/240 — Verificando status da tarefa...`);
    
    const statusResp = await request("GET", statusUrl, jar, undefined, {
      Accept: "text/plain,*/*",
      "X-Requested-With": "XMLHttpRequest",
    });
    
    const statusText = statusResp.text.trim();
    console.log(`[Robo SUAP]   → Status: "${statusText.slice(0, 120)}"`);

    // Verificar se a resposta é diretamente um XLS
    if (isXlsBuffer(statusResp.body, statusResp.headers["content-type"] || "")) {
      console.log("[Robo SUAP] ✓ XLS recebido diretamente da API de status!");
      return statusResp.body;
    }

    // Parsear resposta "percentual::message::file::url"
    const tokens = statusText.split("::");
    const percentual = tokens[0] || "";
    const message = tokens[1] || "";
    const file = tokens[2] || "";
    const urlToken = tokens[3] || "";

    console.log(`[Robo SUAP]   → Progresso: ${percentual}% | Mensagem: "${message.slice(0,60)}" | File: "${file}"`);

    // Se message não está vazio, a tarefa concluiu
    if (message && message.trim().length > 0) {
      console.log(`[Robo SUAP] ✓ Tarefa concluída! Baixando arquivo via ${downloadUrl}`);
      const dlResp = await request("GET", downloadUrl, jar, undefined, {
        Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
      });
      
      const dlCt = dlResp.headers["content-type"] || "";
      console.log(`[Robo SUAP]   → Download: status=${dlResp.status} | ct=${dlCt} | size=${dlResp.body.length}b`);

      if (isXlsBuffer(dlResp.body, dlCt) || dlResp.body.length > 5000) {
        console.log(`[Robo SUAP] ✓ Arquivo baixado com sucesso! ${dlResp.body.length} bytes`);
        return dlResp.body;
      }

      // Se urlToken tem uma URL alternativa
      if (urlToken && urlToken !== ".." && urlToken.length > 5) {
        console.log(`[Robo SUAP]   → Tentando URL alternativa: ${urlToken}`);
        const altResp = await request("GET", resolverPath(urlToken), jar, undefined, {
          Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
        });
        if (altResp.body.length > 5000) return altResp.body;
      }

      throw new Error(`Tarefa concluída mas o arquivo não foi encontrado. Resposta do download: ${dlResp.text.slice(0, 200)}`);
    }

    // Se file está preenchido mas message está vazio
    if (file && file !== ".." && file.length > 0) {
      console.log(`[Robo SUAP] ✓ Arquivo sinalizado como pronto (file=${file})! Baixando...`);
      const dlResp = await request("GET", downloadUrl, jar, undefined, {
        Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
      });
      if (isXlsBuffer(dlResp.body, dlResp.headers["content-type"] || "") || dlResp.body.length > 5000) {
        return dlResp.body;
      }
    }
  }

  throw new Error("Timeout: o SUAP não concluiu a exportação XLS em 20 minutos.");
}





async function uploadToVercel(xlsBuffer) {
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

    console.log("[Robo SUAP] Enviando arquivo para Vercel para importação no banco...");
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

    const xlsBuffer = await sincronizarSUAP(usuario, senha);
    console.log("[Robo SUAP] XLS baixado com sucesso! Tamanho:", xlsBuffer.length, "bytes");

    const result = await uploadToVercel(xlsBuffer);
    console.log("[Robo SUAP] Resposta da Vercel:", result);

  } catch (err) {
    console.error("[Robo SUAP] Erro na sincronização:", err.message);
  }
}

// Executar a cada 2 horas (7200000 ms)
const DUAS_HORAS = 2 * 60 * 60 * 1000;
setInterval(runAutoSync, DUAS_HORAS);

// Executa na inicialização
runAutoSync();

console.log("Robo SUAP rodando. Sincronizará a cada 2 horas.");

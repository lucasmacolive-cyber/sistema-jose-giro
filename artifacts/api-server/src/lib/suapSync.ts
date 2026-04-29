import * as https from "https";
import * as http from "http";
import * as XLSX from "xlsx";
import * as cheerio from "cheerio";
import { parseDiarioPDF, type SecaoDiario } from "./parseDiario.js";

/* ═══════════════════════════════════════════════════════════
   SUAP HTTP Client — Sincronização server-side sem browser
════════════════════════════════════════════════════════════ */

const SUAP_HOST = "suap.campos.rj.gov.br";
const SUAP_BASE = `https://${SUAP_HOST}`;

export type ProgressCallback = (pct: number, msg: string) => void;

/* ── HTTP helper com gerenciamento de cookies ── */
class CookieJar {
  private jar: Record<string, string> = {};

  set(setCookieHeaders: string[] | undefined) {
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

  header(): string {
    return Object.entries(this.jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  get(name: string): string | undefined {
    return this.jar[name];
  }
}

interface Resp {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  text: string;
}

async function request(
  method: string,
  path: string,
  jar: CookieJar,
  body?: string,
  extraHeaders?: Record<string, string>
): Promise<Resp> {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body, "utf8") : undefined;
    const options: https.RequestOptions = {
      hostname: SUAP_HOST,
      path,
      method,
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Cookie": jar.header(),
        ...(bodyBuf
          ? {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": String(bodyBuf.length),
            }
          : {}),
        ...(extraHeaders ?? {}),
      },
    };

    const req = https.request(options, (res) => {
      jar.set(res.headers["set-cookie"]);
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: buf,
          text: buf.toString("utf8"),
        });
      });
    });

    req.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ECONNREFUSED" || e.code === "ENOTFOUND" || e.code === "ETIMEDOUT") {
        reject(new Error(
          `Não foi possível conectar ao SUAP (${SUAP_HOST}). ` +
          `O servidor pode estar temporariamente inacessível a partir do servidor em nuvem. ` +
          `Use a Extensão Chrome ou faça upload manual do XLS.`
        ));
      } else {
        reject(e);
      }
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout de conexão com o SUAP. Tente novamente em alguns minutos."));
    });
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

/* ── Extrair token CSRF do HTML ── */
function extractCsrf(html: string, jar: CookieJar): string {
  const fromHtml =
    html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] ??
    html.match(/csrfmiddlewaretoken[^>]+value="([^"]+)"/)?.[1];
  if (fromHtml) return fromHtml;
  return jar.get("__Host-csrftoken") ?? jar.get("csrftoken") ?? "";
}

/* ═══════════════════════════════════════════════════════════
   Função principal: sincroniza alunos do SUAP
   Retorna Buffer do XLS baixado
════════════════════════════════════════════════════════════ */
/*
 * URL pré-configurada com todos os campos de exibição selecionados.
 * Equivale a "Marcar todos" no formulário do relatório SUAP.
 * Ao fazer GET nessa URL (após login), o SUAP retorna o relatório completo.
 */
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

function isXlsBuffer(body: Buffer, contentType: string): boolean {
  return (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType.includes("octet-stream") ||
    body.slice(0, 4).toString("hex") === "d0cf11e0" || // XLS magic bytes
    body.slice(0, 4).toString() === "PK\x03\x04"       // XLSX magic bytes (ZIP)
  );
}

function encontrarLinkExport(html: string): string | null {
  const allLinks = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  // Prioridade: link com "exportar" + "xls" no href
  const byHref = allLinks.find((h) => {
    const l = h.toLowerCase();
    return (l.includes("export") && l.includes("xls")) ||
      l.includes("formato=xls") ||
      l.includes("gerar_arquivo");
  });
  if (byHref) return byHref;

  // Link com texto "Exportar para XLS"
  const byText = html.match(
    /<a[^>]+href="([^"]+)"[^>]*>[^<]*[Ee]xportar[^<]*[Xx][Ll][Ss][^<]*<\/a>/
  )?.[1];
  if (byText) return byText;

  // Link com .xls no href
  const byXlsHref = allLinks.find((h) => h.toLowerCase().endsWith(".xls") || h.toLowerCase().includes(".xls?"));
  if (byXlsHref) return byXlsHref;

  return null;
}

function encontrarLinkDownload(html: string): string | null {
  const allLinks = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  // Prioridade 1: link com .xls no href
  const byXls = allLinks.find((h) => h.toLowerCase().includes(".xls"));
  if (byXls) return byXls;

  // Prioridade 2: link com "download" ou "arquivo" no href
  const byDl = allLinks.find((h) => {
    const l = h.toLowerCase();
    return l.includes("download") || l.includes("arquivo") || l.includes("continuar");
  });
  if (byDl) return byDl;

  // Prioridade 3: link com texto "baixar", "download", "aqui", "clique"
  const byText = html.match(
    /<a[^>]+href="([^"]+)"[^>]*>[^<]*(baixar|download|clique aqui|aqui|arquivo)[^<]*<\/a>/i
  )?.[1];
  if (byText) return byText;

  return null;
}

function encontrarMetaRefresh(html: string): string | null {
  // <meta http-equiv="refresh" content="5; url=/edu/relatorio/tarefa/123/">
  const m = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"'\s]+)/i);
  if (m) return m[1];
  const m2 = html.match(/<meta[^>]+content=["'][^"']*url=([^"'\s]+)[^"']*["'][^>]+http-equiv=["']refresh["']/i);
  if (m2) return m2[1];
  return null;
}

function resolverPath(href: string): string {
  if (!href) return href;
  if (href.startsWith("http")) {
    try { return new URL(href).pathname + new URL(href).search; } catch { return href; }
  }
  return href;
}

export async function sincronizarSUAP(
  usuario: string,
  senha: string,
  onProgress: ProgressCallback
): Promise<Buffer> {
  const jar = new CookieJar();

  /* ── 1. Login ── */
  onProgress(5, "Abrindo página de login do SUAP...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrfLogin = extractCsrf(loginGet.text, jar);

  if (!csrfLogin) {
    throw new Error("Não foi possível obter token CSRF do SUAP.");
  }

  onProgress(10, "Autenticando no SUAP...");
  const loginBody = new URLSearchParams({
    csrfmiddlewaretoken: csrfLogin,
    this_is_the_login_form: "1",
    next: "/",
    username: usuario,
    password: senha,
  }).toString();

  const loginResp = await request("POST", "/accounts/login/", jar, loginBody, {
    Referer: `${SUAP_BASE}/accounts/login/`,
  });

  if (loginResp.text.includes("accounts/login") && loginResp.status !== 302) {
    throw new Error("Falha no login do SUAP. Verifique as credenciais.");
  }

  onProgress(20, "Login realizado. Acessando relatório de alunos...");

  /* ── 2. Acessar o relatório com URL pré-configurada (GET) ── */
  const reportResp = await request("GET", SUAP_RELATORIO_URL, jar, undefined, {
    Referer: `${SUAP_BASE}/edu/relatorio/`,
  });

  if (reportResp.status !== 200) {
    throw new Error(`Falha ao acessar relatório SUAP (status ${reportResp.status}).`);
  }

  onProgress(35, "Relatório carregado. Procurando link de exportação XLS...");

  /* ── 3. Encontrar e acessar o botão "Exportar para XLS" ── */
  let exportPath = encontrarLinkExport(reportResp.text);

  if (!exportPath) {
    // Fallback: usar URL do relatório + ?formato=xls
    exportPath = "/edu/relatorio/?formato=xls";
    onProgress(38, "Link de exportação não encontrado, tentando URL padrão...");
  } else {
    onProgress(38, `Link de exportação encontrado: ${exportPath}`);
  }

  // Garantir path absoluto
  if (exportPath.startsWith("http")) {
    exportPath = new URL(exportPath).pathname + new URL(exportPath).search;
  }

  onProgress(40, "Solicitando geração do arquivo XLS...");

  const exportResp = await request("GET", exportPath, jar, undefined, {
    Referer: `${SUAP_BASE}/edu/relatorio/`,
    Accept: "application/vnd.ms-excel,application/octet-stream,text/html,*/*",
  });

  /* ── 4. Verificar se já é o arquivo XLS ── */
  const ct = exportResp.headers["content-type"] ?? "";

  if (isXlsBuffer(exportResp.body, ct)) {
    onProgress(85, "Arquivo XLS obtido diretamente!");
    return exportResp.body;
  }

  /* ── 5. Exportação assíncrona — determinar URL da página intermediária ── */
  onProgress(45, "Exportação iniciada. Identificando página de progresso...");

  // Determinar URL da página intermediária (onde o SUAP mostra progresso e link de download)
  let progressPath = exportPath; // padrão: reusar a mesma URL

  if (exportResp.headers.location) {
    // Redirect explícito → essa é a página intermediária
    progressPath = resolverPath(exportResp.headers.location);
    onProgress(46, `Redirecionado para: ${progressPath}`);
  } else if (exportResp.text) {
    // Procurar meta-refresh na resposta
    const metaUrl = encontrarMetaRefresh(exportResp.text);
    if (metaUrl) {
      progressPath = resolverPath(metaUrl);
      onProgress(46, `Página intermediária (meta-refresh): ${progressPath}`);
    } else {
      // Procurar link de tarefa/progresso no HTML
      const taskHref = exportResp.text.match(
        /href="([^"]*(?:tarefa|task|progresso|gerar|arquivo|relatorio)[^"]*)"/i
      )?.[1];
      if (taskHref) {
        progressPath = resolverPath(taskHref);
        onProgress(46, `Página intermediária (link): ${progressPath}`);
      }
    }
  }

  // Aguardar 30 segundos (mínimo exigido pelo SUAP para gerar o XLS)
  onProgress(48, "Aguardando geração do arquivo (30s mínimo)...");
  await sleep(30000);

  // Polling: até 60 segundos adicionais (total ~90s)
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const pollResp = await request("GET", progressPath, jar, undefined, {
      Accept: "text/html,application/octet-stream,*/*",
    });

    const pollCt = pollResp.headers["content-type"] ?? "";

    // Arquivo recebido diretamente?
    if (isXlsBuffer(pollResp.body, pollCt)) {
      onProgress(85, "Arquivo XLS pronto!");
      return pollResp.body;
    }

    const pollText = pollResp.text;

    // Link de download?
    const dlLink = encontrarLinkDownload(pollText);
    if (dlLink) {
      const dlPath = resolverPath(dlLink);
      onProgress(82, "Link de download encontrado. Baixando arquivo...");
      const dlResp = await request("GET", dlPath, jar, undefined, {
        Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
      });

      if (dlResp.body.length > 1000) {
        onProgress(85, "Arquivo XLS baixado com sucesso!");
        return dlResp.body;
      }
    }

    // A própria página intermediária redirecionou para outra?
    if (pollResp.headers.location) {
      progressPath = resolverPath(pollResp.headers.location);
      onProgress(50 + Math.floor((tentativa / 30) * 30), `Seguindo redirect: ${progressPath}`);
      continue;
    }

    // Meta-refresh na página de polling
    const pollMeta = encontrarMetaRefresh(pollText);
    if (pollMeta && pollMeta !== progressPath) {
      progressPath = resolverPath(pollMeta);
      onProgress(50 + Math.floor((tentativa / 30) * 30), `Meta-refresh para: ${progressPath}`);
    }

    // Extrair % de progresso se disponível
    const pctStr = pollText.match(/(\d+)\s*%/)?.[1];
    onProgress(
      50 + Math.floor((tentativa / 30) * 30),
      `Aguardando conclusão do XLS... ${pctStr ? pctStr + "%" : `tentativa ${tentativa + 1}/30`}`
    );

    await sleep(2000);
  }

  throw new Error(
    "Timeout: o SUAP não concluiu a exportação XLS em 90 segundos. Tente novamente em alguns minutos."
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ═══════════════════════════════════════════════════════════
   Parsear XLS e retornar linhas como array de objetos
════════════════════════════════════════════════════════════ */
export function parseXLS(buffer: Buffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

/* ═══════════════════════════════════════════════════════════
   SYNC DE DIÁRIOS — Tipos e utilitários
════════════════════════════════════════════════════════════ */

export type DiarioEncontrado = {
  suapId: string;
  turmaSuap: string;
  turmaLocal: string;
  disciplina: string;
};

export type DiarioSyncResultado = {
  turma: string;
  suapId: string;
  disciplina: string;
  aulasDatas: string[];
  presencas: { alunoId: number; data: string; status: "P" | "F" }[];
  alunosNaoMapeados: string[];
  erro?: string;
};

/** Normaliza nome de turma do SUAP para o formato interno (ex: "6A") */
function normalizarTurma(suapNome: string): string {
  const m = suapNome.match(/(\d+)\s*[°º]\s*[Aa]no\s+([A-Z])/i);
  if (m) return `${m[1]}${m[2].toUpperCase()}`;
  const m2 = suapNome.match(/^(\d+)\s*([A-Z])$/i);
  if (m2) return `${m2[1]}${m2[2].toUpperCase()}`;
  return suapNome.replace(/\s+/g, "").toUpperCase();
}

/** Normaliza nome de aluno para matching (remove acentos, minúscula) */
function normNome(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ═══════════════════════════════════════════════════════════
   Login isolado — retorna CookieJar autenticado
════════════════════════════════════════════════════════════ */
async function suapLogin(usuario: string, senha: string, onProgress: ProgressCallback): Promise<CookieJar> {
  const jar = new CookieJar();
  onProgress(5, "Abrindo página de login do SUAP...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrf = extractCsrf(loginGet.text, jar);
  if (!csrf) throw new Error("Não foi possível obter token CSRF do SUAP.");

  onProgress(12, "Autenticando no SUAP...");
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

/* ═══════════════════════════════════════════════════════════
   Listar diários com jar já autenticado (uso interno)
════════════════════════════════════════════════════════════ */
async function _listarDiarios(jar: CookieJar, onProgress: ProgressCallback): Promise<DiarioEncontrado[]> {
  const urlsParaTentar = [
    "/edu/meus_diarios/",
    "/edu/diarios/?ano_letivo=9",
    "/edu/diarios/",
    "/edu/meu_diario/",
  ];

  const vistos = new Set<string>();
  const diarios: DiarioEncontrado[] = [];

  for (const url of urlsParaTentar) {
    try {
      const resp = await request("GET", url, jar);
      if (resp.status !== 200) continue;
      if (resp.text.toLowerCase().includes("login") && resp.text.includes("csrfmiddlewaretoken")) continue;

      const $ = cheerio.load(resp.text);

      // Busca links /edu/diario/{id}/
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        const m = href.match(/\/edu\/diario\/(\d+)\//);
        if (!m || vistos.has(m[1])) return;
        vistos.add(m[1]);

        const suapId = m[1];
        const linkText = $(el).text().trim();

        // Subir na árvore para capturar contexto da linha
        const row = $(el).closest("tr");
        const rowText = row.text();
        const context = rowText || linkText;

        // Extrair turma
        const turmaMatch = context.match(/(\d+)\s*[°º]\s*[Aa]no\s+([A-Z])/i)
          ?? linkText.match(/(\d+)\s*[°º]\s*[Aa]no\s+([A-Z])/i);
        const turmaSuap = turmaMatch
          ? `${turmaMatch[1]}° Ano ${turmaMatch[2].toUpperCase()}`
          : linkText.split(" - ")[0]?.trim() || `ID ${suapId}`;
        const turmaLocal = normalizarTurma(turmaSuap);

        // Extrair disciplina
        const discMatch = context.match(/(?:-)?\s*(Língua Portuguesa|Matemática|Ciências|História|Geografia|Arte|Educação Física|Ed\.\s*Física|Inglês|Religião|Complementar|[A-ZÁÉÍÓÚ][a-záéíóúâêôç]{3,})/);
        const disciplina = discMatch?.[1]?.trim() ?? "";

        diarios.push({ suapId, turmaSuap, turmaLocal, disciplina });
      });

      if (diarios.length > 0) {
        onProgress(35, `${diarios.length} diários encontrados em ${url}`);
        break;
      }
    } catch (_) {
      continue;
    }
  }

  if (diarios.length === 0) {
    throw new Error(
      "Nenhum diário encontrado no SUAP. Verifique se o usuário tem permissão de acesso aos diários."
    );
  }

  onProgress(40, `${diarios.length} diários encontrados. Iniciando importação...`);
  return diarios;
}

/* ═══════════════════════════════════════════════════════════
   Wrapper público — faz login e lista diários
════════════════════════════════════════════════════════════ */
export async function descobrirDiariosSUAP(
  usuario: string,
  senha: string,
  onProgress: ProgressCallback
): Promise<DiarioEncontrado[]> {
  const jar = await suapLogin(usuario, senha, onProgress);
  return _listarDiarios(jar, onProgress);
}

/* ═══════════════════════════════════════════════════════════
   Buscar presenças de um diário individual
════════════════════════════════════════════════════════════ */
async function buscarPresencasDiario(
  jar: CookieJar,
  suapId: string,
  alunosPorNorma: Map<string, number>
): Promise<{
  datas: string[];
  presencas: { alunoId: number; data: string; status: "P" | "F" }[];
  naoMapeados: string[];
}> {
  const resp = await request("GET", `/edu/diario/${suapId}/`, jar);
  if (resp.status !== 200) {
    throw new Error(`Diário ${suapId} retornou status ${resp.status}`);
  }

  const $ = cheerio.load(resp.text);

  // Encontrar tabela de presenças: procura cabeçalho com datas
  let tabelaEl: cheerio.Cheerio<any> | null = null;

  $("table").each((_, tbl) => {
    const headers = $(tbl).find("th, td").map((_, th) => $(th).text().trim()).get();
    const temData = headers.some(h => /\d{2}\/\d{2}\/\d{4}/.test(h) || /\d{2}\/\d{2}\/\d{2}/.test(h));
    const temNome = headers.some(h => /nome|aluno|matr/i.test(h));
    if (temData || temNome) {
      tabelaEl = $(tbl) as unknown as cheerio.Cheerio<any>;
      return false;
    }
  });

  if (!tabelaEl) {
    return { datas: [], presencas: [], naoMapeados: [] };
  }

  // Extrair cabeçalhos (datas)
  const headerCells = (tabelaEl as any).find("thead th, thead td, tr:first-child th, tr:first-child td");
  const colunas: string[] = [];
  const datasIndices: number[] = [];

  headerCells.each((i: number, el: any) => {
    const txt = $(el).text().trim();
    const title = $(el).attr("title") ?? "";
    // Data pode estar no título ou no texto
    const dataMatch = (title + " " + txt).match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    if (dataMatch) {
      const dd = dataMatch[1];
      const mm = dataMatch[2];
      let yyyy = dataMatch[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      colunas[i] = `${dd}/${mm}/${yyyy}`;
      datasIndices.push(i);
    } else {
      colunas[i] = txt;
    }
  });

  const datas = datasIndices.map(i => colunas[i]).filter(Boolean);
  const presencas: { alunoId: number; data: string; status: "P" | "F" }[] = [];
  const naoMapeados: string[] = [];

  // Iterar linhas de alunos
  (tabelaEl as any).find("tbody tr").each((_: number, tr: any) => {
    const cells = $(tr).find("td");
    if (cells.length < 2) return;

    // Tentar extrair nome do aluno (segunda ou terceira coluna)
    let nomeAluno = "";
    cells.each((ci: number, cell: any) => {
      const txt = $(cell).text().trim();
      if (ci <= 2 && txt.length > 5 && /[A-Za-záéíóú]/.test(txt) && !/^\d+$/.test(txt)) {
        nomeAluno = txt;
        return false;
      }
    });

    if (!nomeAluno) return;

    const alunoId = alunosPorNorma.get(normNome(nomeAluno));
    if (!alunoId) {
      if (!naoMapeados.includes(nomeAluno)) naoMapeados.push(nomeAluno);
      return;
    }

    // Para cada coluna de data, verificar status
    datasIndices.forEach((colIdx, di) => {
      const cell = cells.eq(colIdx);
      const txt = cell.text().trim().toUpperCase();
      const classes = cell.attr("class") ?? "";
      const isFalta = txt === "F" || txt === "FA" || classes.includes("falta") || classes.includes("ausente");
      presencas.push({
        alunoId,
        data: datas[di],
        status: isFalta ? "F" : "P",
      });
    });
  });

  return { datas, presencas, naoMapeados };
}

/* ═══════════════════════════════════════════════════════════
   Função principal: sincronizar todos os diários via PDF
════════════════════════════════════════════════════════════ */
export async function sincronizarDiariosSUAP(
  usuario: string,
  senha: string,
  onProgress: ProgressCallback
): Promise<{ secoes: SecaoDiario[]; erros: { suapId: string; turma: string; erro: string }[] }> {
  const jar = await suapLogin(usuario, senha, onProgress);
  onProgress(20, "Buscando lista de diários...");

  const diariosEncontrados = await _listarDiarios(jar, onProgress);

  // Agrupar diários por turmaLocal para saber quantos cada turma tem
  const porTurmaLocal = new Map<string, DiarioEncontrado[]>();
  for (const d of diariosEncontrados) {
    const lista = porTurmaLocal.get(d.turmaLocal) ?? [];
    lista.push(d);
    porTurmaLocal.set(d.turmaLocal, lista);
  }

  // Para turmas com UM único diário: pegar o regente/Portuguesa (comportamento anterior)
  // Para turmas com MÚLTIPLOS diários (ex: NI = 3 diários, um por ano): baixar TODOS
  //   pois cada diário tem alunos diferentes → precisamos mesclar via upsert
  const turmasParaSync: DiarioEncontrado[] = [];
  for (const [, diarios] of porTurmaLocal) {
    if (diarios.length === 1) {
      turmasParaSync.push(diarios[0]);
    } else {
      // Múltiplos diários para mesma turmaLocal → baixar todos (ex: NI tem 3 subgrupos)
      // Deduplicar por suapId caso a listagem retorne duplicatas
      const vistosId = new Set<string>();
      for (const d of diarios) {
        if (!vistosId.has(d.suapId)) {
          vistosId.add(d.suapId);
          turmasParaSync.push(d);
        }
      }
    }
  }
  const todasSecoes: SecaoDiario[] = [];
  const erros: { suapId: string; turma: string; erro: string }[] = [];

  for (let i = 0; i < turmasParaSync.length; i++) {
    const diario = turmasParaSync[i];
    onProgress(
      40 + Math.floor(((i + 1) / turmasParaSync.length) * 55),
      `Baixando PDF ${i + 1}/${turmasParaSync.length}: turma ${diario.turmaLocal}...`
    );

    try {
      // Baixar o PDF do diário
      const pdfResp = await request("GET", `/edu/diario_pdf/${diario.suapId}/0/`, jar);
      if (pdfResp.status !== 200) {
        erros.push({ suapId: diario.suapId, turma: diario.turmaLocal, erro: `HTTP ${pdfResp.status}` });
        continue;
      }

      // Parsear o PDF com o parser de diários
      const { secoes, erros: errsPDF } = await parseDiarioPDF(pdfResp.body);

      // Sobrescrever turmaLocal de cada seção com o valor já conhecido do SUAP HTML.
      // Isso garante que códigos como "NIAM01" ou "NIM01" sejam corretamente
      // mapeados para "NI" (ou qualquer outro nome normalizado vindo do listing).
      for (const secao of secoes) {
        secao.turmaLocal = diario.turmaLocal;
      }

      todasSecoes.push(...secoes);
      for (const e of errsPDF) {
        erros.push({ suapId: diario.suapId, turma: diario.turmaLocal, erro: e });
      }
    } catch (e: any) {
      erros.push({ suapId: diario.suapId, turma: diario.turmaLocal, erro: e.message });
    }

    await sleep(400);
  }

  onProgress(98, "Finalizando importação...");
  return { secoes: todasSecoes, erros };
}

export type { SecaoDiario };

/* ═══════════════════════════════════════════════════════════
   Baixar PDF de um único diário dado o link da página
════════════════════════════════════════════════════════════ */
export async function baixarDiarioPorLink(
  usuario: string,
  senha: string,
  link: string,
): Promise<Buffer> {
  const jar = await suapLogin(usuario, senha, () => {});
  const m = link.match(/\/edu\/diario\/(\d+)\//);
  if (!m) throw new Error(`Link inválido: "${link}". Use o formato .../edu/diario/ID/`);
  const suapId = m[1];
  const resp = await request("GET", `/edu/diario_pdf/${suapId}/0/`, jar);
  if (resp.status !== 200) {
    throw new Error(`Erro HTTP ${resp.status} ao baixar o PDF do diário (ID ${suapId})`);
  }
  return resp.body;
}

/* ═══════════════════════════════════════════════════════════
   Identificar quais turmas correspondem a cada link salvo
   (usa a listagem de diários do SUAP — 1 login + 1-2 páginas)
════════════════════════════════════════════════════════════ */
export async function identificarDiarioPorLinks(
  usuario: string,
  senha: string,
  links: string[],
): Promise<{ link: string; suapId: string; turmaLocal: string; disciplina: string }[]> {
  const jar = await suapLogin(usuario, senha, () => {});
  const diarios = await _listarDiarios(jar, () => {});
  const resultado: { link: string; suapId: string; turmaLocal: string; disciplina: string }[] = [];
  for (const link of links) {
    const m = link.match(/\/edu\/diario\/(\d+)\//);
    if (!m) continue;
    const suapId = m[1];
    const diario = diarios.find(d => d.suapId === suapId);
    if (diario) {
      resultado.push({
        link,
        suapId,
        turmaLocal: diario.turmaLocal,
        disciplina: diario.disciplina ?? "",
      });
    }
  }
  return resultado;
}

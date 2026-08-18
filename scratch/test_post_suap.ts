import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import https from "https";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const SUAP_HOST = "suap.campos.rj.gov.br";

class SimpleJar {
  cookies: Record<string, string> = {};
  set(setCookie: string | string[] | undefined) {
    if (!setCookie) return;
    const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of arr) {
      const parts = c.split(";")[0].split("=");
      if (parts[0] && parts[1] !== undefined) {
        this.cookies[parts[0].trim()] = parts[1].trim();
      }
    }
  }
  header() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function req(method: string, pathUrl: string, jar: SimpleJar, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    };
    const cookieStr = jar.header();
    if (cookieStr) headers["Cookie"] = cookieStr;
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = String(Buffer.byteLength(body));
    }

    const request = https.request({
      hostname: SUAP_HOST,
      path: pathUrl,
      method,
      headers
    }, (res) => {
      jar.set(res.headers["set-cookie"]);
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, text: buf.toString("utf8"), body: buf });
      });
    });
    if (body) request.write(body);
    request.end();
  });
}

async function testPost() {
  const jar = new SimpleJar();
  console.log("Logging in...");
  const g = await req("GET", "/accounts/login/", jar);
  const csrf = g.text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || jar.cookies["csrftoken"] || "";

  const l = await req("POST", "/accounts/login/", jar, new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    this_is_the_login_form: "1",
    next: "/",
    username: process.env.SUAP_USUARIO ?? "21501",
    password: process.env.SUAP_SENHA ?? "12314569733",
  }).toString());

  console.log("Login status:", l.status, "Location:", l.headers.location);

  const relUrl = "/edu/relatorio/?uo=205&diretoria=&estrutura_curso=&modalidade=&convenio=&polo=&ano_letivo=&periodo_letivo=0&periodo_matriz=0&periodo_referencia=0&ano_conclusao=&situacao_diario=0&turno=&situacao_matricula=&situacao_matricula_periodo=&ano_ingresso_inicio=&periodo_ingresso_inicio=0&ano_ingresso_fim=&periodo_ingresso_fim=0&aluno_especial=&forma_ingresso=&situacao_sistema=TODOS&medida_disciplinar=0&percentual_conclusao_curso_inicial=&percentual_conclusao_curso_final=&tipo_necessidade_especial=0&tipo_transtorno=0&superdotacao=0&pendencias=&formatacao=simples&quantidade_itens=10000&ordenacao=Nome&agrupamento=Campus&exibicao=ano_letivo_integralizacao&exibicao=ano_let_prev_conclusao&exibicao=ano_conclusao&exibicao=ano_letivo&exibicao=pessoa_fisica.cpf&exibicao=cpf_responsavel&exibicao=curso_campus.diretoria.setor.uo&exibicao=get_chave_responsavel&exibicao=cidade.nome&exibicao=convenio&exibicao=cota_mec&exibicao=cota_sistec&exibicao=curso_campus.codigo&exibicao=codigo_educacenso&exibicao=get_projeto_final_aprovado.data_defesa&exibicao=dt_conclusao_curso&exibicao=data_conclusao_intercambio&exibicao=data_integralizacao&exibicao=data_matricula&exibicao=pessoa_fisica.nascimento_data&exibicao=get_data_ultimo_procedimento_periodo_referencia&exibicao=get_tipo_necessidade_especial_display&exibicao=curso_campus.descricao&exibicao=curso_campus.diretoria&exibicao=candidato_vaga.candidato.edital&exibicao=pessoa_fisica.email&exibicao=email_google_classroom&exibicao=pessoa_fisica.email_secundario&exibicao=email_responsavel&exibicao=get_endereco&exibicao=cidade.estado.get_sigla&exibicao=estado_civil&exibicao=pessoa_fisica.raca&exibicao=forma_ingresso&exibicao=get_frequencia_periodo_referencia&exibicao=ira&exibicao=matriz&exibicao=curso_campus.modalidade&exibicao=cidade&exibicao=cidade.codigo&exibicao=nacionalidade&exibicao=naturalidade&exibicao=naturalidade.codigo&exibicao=curso_campus.natureza_participacao&exibicao=nome_mae&exibicao=nome_pai&exibicao=numero_pasta&exibicao=curso_campus.modalidade.nivel_ensino&exibicao=observacao_historico&exibicao=get_observacoes&exibicao=pais_origem&exibicao=pendencias&exibicao=percentual_ch_cumprida&exibicao=periodo_atual&exibicao=periodo_letivo_integralizacao&exibicao=periodo_letivo&exibicao=periodo_ano_consulta&exibicao=polo&exibicao=get_rg&exibicao=caracterizacao.renda_per_capita&exibicao=responsavel&exibicao=pessoa_fisica.sexo&exibicao=situacao_ano_consulta&exibicao=situacao&exibicao=get_situacao_periodo_referencia&exibicao=get_superdotacao_display&exibicao=get_telefones&exibicao=tipo_instituicao_origem&exibicao=get_poder_publico_responsavel_transporte_display&exibicao=get_tipo_veiculo_display&exibicao=get_tipo_transtorno_display&exibicao=get_ultima_matricula_periodo.turma&exibicao=turma_ano_consulta&exibicao=turno&exibicao=get_tipo_zona_residencial_display&relatorio_form=Aguarde...";

  console.log("GET relatorio...");
  const r = await req("GET", relUrl, jar);
  const reportCsrf = r.text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || jar.cookies["csrftoken"] || "";

  console.log("POST export...");
  const exp = await req("POST", relUrl + "&xls=1", jar, new URLSearchParams({
    csrfmiddlewaretoken: reportCsrf,
    xls: "1"
  }).toString());

  console.log("POST Export Status:", exp.status);
  console.log("POST Export Location:", exp.headers.location);
  console.log("POST Export Content-Type:", exp.headers["content-type"]);
  console.log("POST Export Body Length:", exp.body.length);
  fs.writeFileSync("scratch/post_output.html", exp.text);
  console.log("Saved scratch/post_output.html");
}

testPost().catch(console.error);

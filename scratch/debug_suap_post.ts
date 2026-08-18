import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.join(process.cwd(), ".env") });

import { CookieJar, request, extractCsrf } from "../api/lib/suapSync.ts";

const SUAP_BASE = "https://suap.campos.rj.gov.br";

async function debugPost() {
  const usuario = process.env.SUAP_USUARIO ?? "21501";
  const senha = process.env.SUAP_SENHA ?? "12314569733";

  const jar = new CookieJar();
  console.log("1. GET login page...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrfLogin = extractCsrf(loginGet.text, jar);

  console.log("2. POST login...");
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

  console.log("Login status:", loginResp.status);

  console.log("3. GET report form page...");
  const SUAP_RELATORIO_URL =
    "/edu/relatorio/?uo=205&diretoria=&estrutura_curso=&modalidade=&convenio=&polo=" +
    "&ano_letivo=&periodo_letivo=0&periodo_matriz=0&periodo_referencia=0&ano_conclusao=" +
    "&situacao_diario=0&turno=&situacao_matricula=&situacao_matricula_periodo=" +
    "&ano_ingresso_inicio=&periodo_ingresso_inicio=0&ano_ingresso_fim=&periodo_ingresso_fim=0" +
    "&aluno_especial=&forma_ingresso=&situacao_sistema=TODOS&medida_disciplinar=0" +
    "&percentual_conclusao_curso_inicial=&percentual_conclusao_curso_final=" +
    "&tipo_necessidade_especial=0&tipo_transtorno=0&superdotacao=0&pendencias=" +
    "&formatacao=simples&quantidade_itens=10000&ordenacao=Nome&agrupamento=Campus" +
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

  const reportResp = await request("GET", SUAP_RELATORIO_URL, jar);
  console.log("Report GET status:", reportResp.status);

  const reportCsrf = reportResp.text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || jar.get("csrftoken") || "";
  console.log("CSRF token:", reportCsrf);

  console.log("4. POST export xls...");
  const exportBody = new URLSearchParams();
  exportBody.append("csrfmiddlewaretoken", reportCsrf);
  exportBody.append("xls", "1");

  const exportResp = await request("POST", SUAP_RELATORIO_URL + "&xls=1", jar, exportBody.toString(), {
    Referer: `${SUAP_BASE}${SUAP_RELATORIO_URL}`,
    "X-CSRFToken": reportCsrf,
    Accept: "application/vnd.ms-excel,application/octet-stream,text/html,*/*",
  });

  console.log("Export POST status:", exportResp.status);
  console.log("Export headers:", exportResp.headers);
  console.log("Export body snippet (first 800 chars):");
  console.log(exportResp.text.slice(0, 800));

  fs.writeFileSync("scratch/debug_export_resp.html", exportResp.text);
  console.log("Saved response to scratch/debug_export_resp.html");
}

debugPost();

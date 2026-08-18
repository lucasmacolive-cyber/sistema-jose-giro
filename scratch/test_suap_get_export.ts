import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.join(process.cwd(), ".env") });

import { request, extractCsrf } from "../api/lib/suapSync.ts";
import { CookieJar } from "tough-cookie";

const SUAP_BASE = "https://suap.campos.rj.gov.br";

async function testGetExport() {
  const usuario = process.env.SUAP_USUARIO ?? "21501";
  const senha = process.env.SUAP_SENHA ?? "12314569733";

  const jar = new CookieJar();
  console.log("Login...");
  const loginGet = await request("GET", "/accounts/login/", jar);
  const csrfLogin = extractCsrf(loginGet.text, jar);
  await request("POST", "/accounts/login/", jar, new URLSearchParams({
    csrfmiddlewaretoken: csrfLogin,
    this_is_the_login_form: "1",
    next: "/",
    username: usuario,
    password: senha,
  }).toString(), { Referer: `${SUAP_BASE}/accounts/login/` });

  const BASE_URL =
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

  console.log("GET relatorio page...");
  const reportResp = await request("GET", BASE_URL, jar);

  // Search for any button or link with 'xls' or 'export' in reportResp.text
  const exportLinks = [...reportResp.text.matchAll(/href="([^"]*export[^"]*|[^"]*xls[^"]*)"/gi)].map(m => m[1]);
  console.log("Export links found on report page:", exportLinks);

  const formActions = [...reportResp.text.matchAll(/<form[^>]+action="([^"]+)"[^>]*>/gi)].map(m => m[1]);
  console.log("Form actions found on report page:", formActions);

  const submitInputs = [...reportResp.text.matchAll(/<input[^>]+type="submit"[^>]*>/gi)].map(m => m[0]);
  console.log("Submit inputs found:", submitInputs);
}

testGetExport().catch(console.error);

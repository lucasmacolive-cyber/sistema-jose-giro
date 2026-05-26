// @ts-nocheck
import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Loader2, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CabecalhoTimbrado } from "@/components/CabecalhoTimbrado";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";

interface Aluno {
  id: number;
  matricula: string;
  nomeCompleto: string;
  dataNascimento: string;
  turmaAtual: string;
  turno: string;
  nomeMae: string;
  nomePai: string;
  responsavel: string;
  telefone: string;
  endereco: string;
  situacao: string;
  etnia: string;
  cpf: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "____________________";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`;
}

function getAnoEscolaridade(turmaName: string | null | undefined): string | null {
  if (!turmaName) return null;
  const upper = turmaName.toUpperCase();
  if (upper.includes("P1") || upper.includes("PRE 1") || upper.includes("PRÉ 1") || upper.includes("PRÉ I")) return "P1";
  if (upper.includes("P2") || upper.includes("PRE 2") || upper.includes("PRÉ 2") || upper.includes("PRÉ II")) return "P2";
  if (upper.includes("1º") || upper.includes("1O ") || upper.includes("1 AN")) return "1º";
  if (upper.includes("2º") || upper.includes("2O ") || upper.includes("2 AN")) return "2º";
  if (upper.includes("3º") || upper.includes("3O ") || upper.includes("3 AN")) return "3º";
  if (upper.includes("4º") || upper.includes("4O ") || upper.includes("4 AN")) return "4º";
  if (upper.includes("5º") || upper.includes("5O ") || upper.includes("5 AN")) return "5º";
  if (upper.includes("6º") || upper.includes("6O ") || upper.includes("6 AN")) return "6º";
  if (upper.includes("7º") || upper.includes("7O ") || upper.includes("7 AN")) return "7º";
  if (upper.includes("8º") || upper.includes("8O ") || upper.includes("8 AN")) return "8º";
  if (upper.includes("9º") || upper.includes("9O ") || upper.includes("9 AN")) return "9º";
  if (upper.includes("EJA") || upper.includes("FASE")) return "EJA";
  return null;
}

export default function FicaiPage() {
  const [params, setParams] = useState<{ ids: number[]; mes: string; ano: string }>({
    ids: [],
    mes: "",
    ano: ""
  });
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const idsStr = searchParams.get("ids") || "";
    const ids = idsStr.split(",").map(Number).filter(id => !isNaN(id) && id > 0);
    const mes = searchParams.get("mes") || MESES[new Date().getMonth()];
    const ano = searchParams.get("ano") || String(new Date().getFullYear());
    
    setParams({ ids, mes, ano });

    // Se o parâmetro print=true estiver na URL, disparar a impressão assim que carregar
    if (searchParams.get("print") === "true") {
      setTimeout(() => {
        window.print();
      }, 1000);
    }
  }, []);

  // Buscar detalhes de todos os alunos selecionados em paralelo
  const { data: alunos, isLoading } = useQuery<Aluno[]>({
    queryKey: ["ficai-alunos", params.ids],
    queryFn: async () => {
      if (params.ids.length === 0) return [];
      const promises = params.ids.map(id =>
        fetch(`${BASE}api/alunos/${id}`, { credentials: "include" }).then(res => {
          if (!res.ok) throw new Error(`Erro ao carregar aluno ${id}`);
          return res.json();
        })
      );
      return Promise.all(promises);
    },
    enabled: params.ids.length > 0
  });

  function handlePrint() {
    window.print();
  }

  function handleBack() {
    window.history.back();
  }

  async function handlePrintRicoh() {
    if (!alunos || alunos.length === 0) return;
    setImprimindoRicoh(true);
    try {
      // Gerar HTML unificado para todos os alunos selecionados
      const htmlContent = document.getElementById("ficai-print-content")?.innerHTML || "";
      if (!htmlContent) throw new Error("Conteúdo de impressão não encontrado");

      // Embrulhar em um HTML válido
      const htmlDocument = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>FICAI - E.M. José Giró Faísca</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #000; background: #fff; }
            .ficai-page { page-break-after: always; box-sizing: border-box; padding: 1.5cm; width: 100%; min-height: 29.7cm; font-family: Arial, Helvetica, sans-serif; }
            .ficai-page:last-child { page-break-after: avoid; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .underline { text-decoration: underline; }
            .border { border: 1px solid #000; }
            .border-t { border-top: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .p-2 { padding: 8px; }
            .mb-4 { margin-bottom: 16px; }
            .mt-4 { margin-top: 16px; }
            .w-full { width: 100%; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
            .flex-col { display: flex; flex-direction: column; }
            .justify-between { justify-content: space-between; }
            /* Estilo dos checkboxes e tabelas */
            table.motivos-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 8.5pt; }
            table.motivos-table td { border: 1px solid #000; padding: 5px; vertical-align: top; }
            .checkbox-box { width: 12px; height: 12px; border: 1px solid #000; display: inline-block; text-align: center; line-height: 10px; font-size: 8pt; font-weight: bold; }
            .line-row { border-bottom: 1px solid #ccc; height: 28px; width: 100%; margin-top: 4px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const blob = new Blob([htmlDocument], { type: "text/html" });
      const file = new File([blob], `FICAI_${alunos.map(a => a.nomeCompleto.split(" ")[0]).join("_")}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", "Articulador - Karine Trajano");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const res = await fetch(`${BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao registrar impressão");
      
      toast({
        title: "Enviado com sucesso!",
        description: `${alunos.length === 1 ? "A ficha" : "As fichas"} de FICAI foram enviadas para a fila da RICOH.`,
        variant: "default"
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Erro de conexão com a impressora.",
        variant: "destructive"
      });
    } finally {
      setImprimindoRicoh(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm text-gray-400">Carregando dados dos alunos...</p>
      </div>
    );
  }

  if (!alunos || alunos.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-8">
        <p className="text-lg font-bold text-red-400 mb-4">Nenhum aluno selecionado</p>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center p-4 sm:p-8 print:p-0 print:bg-white print:text-black">
      {/* Barra de Ações - Invisível na Impressão */}
      <div className="w-full max-w-[850px] flex items-center justify-between mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 backdrop-blur-md print:hidden gap-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex gap-2">
          <button
            onClick={handlePrintRicoh}
            disabled={imprimindoRicoh}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white border border-white/10 transition-all active:scale-95 disabled:bg-slate-800/40 disabled:border-white/5 disabled:text-white/20 shrink-0"
          >
            {imprimindoRicoh ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            Imprimir na RICOH
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-lg active:scale-95 shrink-0"
          >
            <Printer className="w-4 h-4" />
            Imprimir local
          </button>
        </div>
      </div>

      {/* Container de impressão */}
      <div id="ficai-print-content" className="w-full max-w-[850px] flex flex-col gap-8 print:gap-0">
        {alunos.map((aluno, index) => {
          const anoEscolaridade = getAnoEscolaridade(aluno.turmaAtual);
          const dataAtual = new Date();
          const diaStr = String(dataAtual.getDate()).padStart(2, "0");
          const mesStr = MESES[dataAtual.getMonth()];
          const anoStr = String(dataAtual.getFullYear());
          
          return (
            <div key={aluno.id} className="student-ficai-doc print:w-full">
              {/* PAGE 1: DADOS DO ALUNO E DADOS DA ESCOLA */}
              <div className="ficai-page bg-white text-black p-12 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:min-h-screen flex flex-col justify-between font-sans">
                <div>
                  {/* Cabeçalho */}
                  <CabecalhoTimbrado 
                    infoDinamica={
                      <div className="flex justify-end w-full">
                        <span className="bg-black text-white px-2 py-0.5 rounded font-extrabold text-[8pt] tracking-normal normal-case">FICAI - 2026</span>
                      </div>
                    }
                    className="mb-4 select-none"
                  />

                  <h2 className="text-center font-bold text-[11pt] uppercase tracking-wide mb-4">
                    FICHA DE COMUNICAÇÃO DE ALUNO INFREQUENTE<br/>
                    <span className="text-[9.5pt] font-semibold">EDUCAÇÃO INFANTIL / ENSINO FUNDAMENTAL I, II E EJA</span>
                  </h2>

                  {/* Informações Básicas */}
                  <div className="grid grid-cols-3 gap-2 text-[9pt] mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-black">
                    <div>
                      <span className="font-bold">Mês de Referência:</span>
                      <p className="underline font-semibold decoration-dotted mt-0.5">{params.mes}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold">Escola Municipal:</span>
                      <p className="font-semibold mt-0.5">José Giró Faísca</p>
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold">Articulador(a):</span>
                      <p className="font-semibold mt-0.5">Karine Trajano Silveira Martins</p>
                    </div>
                    <div>
                      <span className="font-bold">Tel. Articulador(a):</span>
                      <p className="font-semibold mt-0.5">(22) 99847-9624</p>
                    </div>
                  </div>

                  <p className="text-[8pt] italic text-slate-500 mb-4 text-center select-none print:text-black">
                    A frequência deverá ser consultada no Sistema Unificado de Administração Pública (SUAP).
                  </p>

                  {/* Dados do Aluno */}
                  <div className="border border-black rounded-lg p-4 mb-4 text-[9pt] space-y-3">
                    <h3 className="font-bold text-[9.5pt] border-b border-black pb-1 uppercase tracking-wider select-none">1 - DADOS DO ALUNO(A):</h3>
                    
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-3">
                        <span className="text-slate-500 font-semibold print:text-black">Nome:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.nomeCompleto}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold print:text-black">Data de Nascimento:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.dataNascimento || "___/___/______"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-500 font-semibold print:text-black">CPF do aluno:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{formatCPF(aluno.cpf)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold print:text-black">Cor/Raça:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.etnia || "________________"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold print:text-black">Telefone:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.telefone || "________________"}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold print:text-black">Filiação (Mãe/Pai):</span>
                      <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">
                        {aluno.nomeMae ? `Mãe: ${aluno.nomeMae}` : ""}
                        {aluno.nomePai ? ` / Pai: ${aluno.nomePai}` : ""}
                        {!aluno.nomeMae && !aluno.nomePai ? "________________________________________________" : ""}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold print:text-black">Responsável pelo aluno(a):</span>
                      <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.responsavel || "________________________________________________"}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <span className="text-slate-500 font-semibold print:text-black">Endereço:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">{aluno.endereco || "________________________________________________"}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold print:text-black">Bairro:</span>
                        <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">
                          {aluno.endereco?.toLowerCase().includes("bairro") 
                            ? aluno.endereco.split(/bairro/i)[1]?.trim().replace(/^:/, "").trim().split(",")[0]
                            : "________________"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold print:text-black">Ponto de referência:</span>
                      <p className="font-bold border-b border-slate-300 pb-0.5 mt-0.5 print:border-black">____________________________________________________________________</p>
                    </div>
                  </div>

                  {/* Ano de Escolaridade */}
                  <div className="border border-black rounded-lg p-4 mb-4 text-[9pt]">
                    <h3 className="font-bold text-[9.5pt] border-b border-black pb-1 uppercase tracking-wider mb-2 select-none">2 - ANO DE ESCOLARIDADE:</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 select-none">
                      {["P1", "P2", "1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º", "EJA"].map((anoItem) => {
                        const isChecked = anoEscolaridade === anoItem;
                        return (
                          <div key={anoItem} className="flex items-center gap-1.5 font-medium">
                            <span className="checkbox-box select-none">{isChecked ? "X" : ""}</span>
                            <span>{anoItem}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Relato Busca Ativa */}
                  <div className="border border-black rounded-lg p-4 mb-4 text-[9pt]">
                    <h3 className="font-bold text-[9.5pt] border-b border-black pb-1 uppercase tracking-wider mb-2 select-none">3 - RELATO DO ARTICULADOR / DIRETOR REFERENTE À BUSCA ATIVA:</h3>
                    <div className="space-y-1">
                      <div className="line-row"></div>
                      <div className="line-row"></div>
                      <div className="line-row"></div>
                      <div className="line-row"></div>
                      <div className="line-row"></div>
                    </div>
                  </div>

                  {/* Motivos Identificados */}
                  <div className="border border-black rounded-lg p-4 mb-4 text-[9pt]">
                    <h3 className="font-bold text-[9.5pt] border-b border-black pb-1 uppercase tracking-wider select-none">4 - MOTIVOS IDENTIFICADOS PELA ESCOLA ENCAMINHADOS AO SERVIÇO SOCIAL:</h3>
                    <table className="motivos-table select-none">
                      <tbody>
                        <tr>
                          <td style={{ width: "3%" }}><span className="checkbox-box"></span></td>
                          <td style={{ width: "47%" }} className="font-medium">1 - Trabalho infantojuvenil</td>
                          <td style={{ width: "3%" }}><span className="checkbox-box"></span></td>
                          <td style={{ width: "47%" }} className="font-medium">7 - Aluno(a) com suspeita de envolvimento com substâncias ilícitas ou com envolvimento no tráfico</td>
                        </tr>
                        <tr>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">2 - Evasão do aluno do núcleo familiar</td>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">8 - Possível situação de suspeita de exploração e abuso sexual.</td>
                        </tr>
                        <tr>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">3 - Gravidez da aluna na adolescência</td>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">9 - Violência sofrida pelo responsável ou membro familiar</td>
                        </tr>
                        <tr>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">4 - Possível negligência dos responsáveis relacionada a situação de saúde, maus tratos, compromisso com a frequência escolar, etc...</td>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">10 - Violência sofrida pelo(a) aluno(a) no ambiente familiar</td>
                        </tr>
                        <tr>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">5 - Faltas recorrentes pela necessidade de cuidar de familiares e/ou serviços domésticos</td>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">11 - Violência sofrida pelo aluno no ambiente escolar (física, psicológica, ameaça).</td>
                        </tr>
                        <tr>
                          <td><span className="checkbox-box"></span></td>
                          <td className="font-medium">6 - Suspeita de envolvimento com substâncias ilícitas (por parte da família).</td>
                          <td></td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Assinaturas Parte 1 */}
                <div className="mt-8 text-[9pt] border-t border-slate-200 pt-4 print:border-black">
                  <div className="grid grid-cols-2 gap-8 text-center">
                    <div>
                      <p className="text-left mb-6">Campos dos Goytacazes, <span className="font-bold underline">&nbsp;&nbsp;{diaStr}&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;{mesStr}&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;{anoStr}&nbsp;&nbsp;</span>.</p>
                      <div className="border-t border-black w-[80%] mx-auto pt-1 mt-10"></div>
                      <p className="font-bold text-[8pt] uppercase">Assinatura e Matrícula do/a Diretor/a</p>
                    </div>
                    <div>
                      <p className="text-left mb-6">Campos dos Goytacazes, <span className="font-bold underline">&nbsp;&nbsp;{diaStr}&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;{mesStr}&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;{anoStr}&nbsp;&nbsp;</span>.</p>
                      <div className="border-t border-black w-[80%] mx-auto pt-1 mt-10"></div>
                      <p className="font-bold text-[8pt] uppercase">Assinatura e Matrícula do/a Articulador/a</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 2: RELATO DO ATENDIMENTO DO SERVIÇO SOCIAL */}
              <div className="ficai-page bg-white text-black p-12 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:min-h-screen flex flex-col justify-between font-sans page-break">
                <div>
                  <div className="flex items-center justify-between border-b border-black pb-3 mb-6 select-none">
                    <p className="text-[8.5pt] font-bold text-slate-500 uppercase">Ficha FICAI - Serviço Social</p>
                    <p className="text-[8.5pt] font-semibold text-slate-500">Aluno: {aluno.nomeCompleto}</p>
                  </div>
                  
                  <h3 className="font-bold text-[10pt] uppercase border-b-2 border-black pb-1 mb-4 tracking-wider select-none">
                    RELATO DO ATENDIMENTO DO SERVIÇO SOCIAL:
                  </h3>
                  
                  <div className="space-y-1">
                    {Array.from({ length: 26 }).map((_, idx) => (
                      <div key={idx} className="line-row"></div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 text-[9pt]">
                  <div className="w-[50%] ml-auto text-center">
                    <p className="text-left mb-6">Campos dos Goytacazes, <span className="font-bold underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de 2026.</p>
                    <div className="border-t border-black w-[80%] mx-auto pt-1 mt-10"></div>
                    <p className="font-bold text-[8pt] uppercase">Assinatura do/a Assistente Social</p>
                  </div>
                </div>
              </div>

              {/* PAGE 3: MEDIDAS APLICADAS PELO CONSELHO TUTELAR */}
              <div className="ficai-page bg-white text-black p-12 rounded-2xl shadow-2xl border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:min-h-screen flex flex-col justify-between font-sans page-break">
                <div>
                  <div className="flex items-center justify-between border-b border-black pb-3 mb-6 select-none">
                    <p className="text-[8.5pt] font-bold text-slate-500 uppercase">Ficha FICAI - Conselho Tutelar</p>
                    <p className="text-[8.5pt] font-semibold text-slate-500">Aluno: {aluno.nomeCompleto}</p>
                  </div>
                  
                  <h3 className="font-bold text-[10pt] uppercase border-b-2 border-black pb-1 mb-4 tracking-wider select-none">
                    MEDIDAS APLICADAS PELO CONSELHO TUTELAR:
                  </h3>
                  
                  <div className="space-y-1">
                    {Array.from({ length: 22 }).map((_, idx) => (
                      <div key={idx} className="line-row"></div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 text-[9pt]">
                  <div className="w-[50%] ml-auto text-center">
                    <p className="text-left mb-6">Campos dos Goytacazes, <span className="font-bold underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de <span className="font-bold underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> de 2026.</p>
                    <div className="border-t border-black w-[80%] mx-auto pt-1 mt-10"></div>
                    <p className="font-bold text-[8pt] uppercase">Assinatura do/a Conselheiro/a Tutelar</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CSS de impressão unificado */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .ficai-page {
            page-break-after: always !important;
            height: 29.7cm !important;
            width: 21cm !important;
            box-sizing: border-box !important;
            padding: 1.5cm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .student-ficai-doc:last-child .ficai-page:last-child {
            page-break-after: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

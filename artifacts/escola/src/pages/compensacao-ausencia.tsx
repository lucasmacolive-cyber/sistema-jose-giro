// @ts-nocheck
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";

export default function CompensacaoAusenciaPage() {
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const dataAtual = new Date();
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const aluno = searchParams.get("aluno") || "__________________________________________________________";
    const turma = searchParams.get("turma") || "________";
    const escola = searchParams.get("escola") || "Escola Municipal José Giró Faísca";
    const professor = searchParams.get("professor") || "________________________________________________________";
    const datasRaw = searchParams.get("datas") || "";
    
    // Formatar as datas para exibir de forma bonita: "04/05/2026, 11/05/2026 e 18/05/2026"
    let datasFormated = "__________________________________________________________________________________________________________________________________________________";
    if (datasRaw) {
      const listaDatas = datasRaw.split(",").map(d => d.trim()).filter(Boolean);
      if (listaDatas.length > 0) {
        if (listaDatas.length === 1) {
          datasFormated = listaDatas[0];
        } else {
          const ult = listaDatas.pop();
          datasFormated = listaDatas.join(", ") + " e " + ult;
        }
      }
    }

    const dia = searchParams.get("dia") || String(dataAtual.getDate()).padStart(2, "0");
    const mes = searchParams.get("mes") || meses[dataAtual.getMonth()];
    const ano = searchParams.get("ano") || String(dataAtual.getFullYear());

    setParams({
      aluno,
      turma,
      escola,
      professor,
      datas: datasFormated,
      dia,
      mes,
      ano
    });
  }, []);

  function handlePrint() {
    window.print();
  }

  function handleBack() {
    window.history.back();
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center p-4 sm:p-8 print:p-0 print:bg-white print:text-black">
      {/* Barra de Ações - Invisível na Impressão */}
      <div className="w-full max-w-[800px] flex items-center justify-between mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 backdrop-blur-md print:hidden">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o Diário
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 hover:scale-105 text-white transition-all shadow-lg shadow-amber-950/40 active:scale-95 animate-pulse hover:animate-none"
        >
          <Printer className="w-4 h-4" />
          Imprimir Compensação
        </button>
      </div>

      {/* Folha do Documento - Tamanho A4 proporcional na tela e exato na impressão */}
      <div className="w-full max-w-[800px] bg-white text-black p-12 sm:p-16 rounded-2xl shadow-2xl flex flex-col justify-between font-serif aspect-[1/1.414] border border-slate-200 print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:w-full print:max-w-none print:aspect-auto">
        
        {/* Cabeçalho */}
        <div className="text-center space-y-4 mb-12">
          <div className="flex justify-center items-center gap-4">
            <img 
              src="/logo.png" 
              alt="Logo Prefeitura" 
              className="w-16 h-16 object-contain error-fallback" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="text-center font-sans">
              <h2 className="text-base font-extrabold tracking-wide uppercase">Prefeitura Municipal de Campos dos Goytacazes</h2>
              <p className="text-xs font-semibold text-gray-700">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
              <p className="text-xs text-gray-600">Resolução Seduct N° 02 de 27 de março de 2024</p>
            </div>
          </div>
          <div className="h-[2px] bg-black w-full my-4" />
          <h1 className="text-lg font-black tracking-normal uppercase mt-6 text-center leading-relaxed">
            DECLARAÇÃO DE ACOMPANHAMENTO DO PROGRAMA DE COMPENSAÇÃO DE AUSÊNCIAS
          </h1>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 space-y-8 text-justify text-base leading-loose font-normal">
          <p>
            Declaramos que o(a) aluno(a) <strong className="underline decoration-1 underline-offset-4">{params.aluno}</strong>, 
            matriculado(a) na Turma <strong>{params.turma}</strong>, 
            da Unidade Escolar: <strong>{params.escola}</strong>, 
            professor regente <strong className="underline decoration-1 underline-offset-4">{params.professor}</strong>, 
            cumpriu com êxito os termos da Resolução Seduct N° 02 de 27 de março de 2024, que estabelece as Diretrizes para a Realização do Programa de Compensação de Ausência dos Discentes da Rede Municipal de Educação de Campos dos Goytacazes/RJ.
          </p>

          <p className="pt-4">
            Na(s) seguinte(s) data(s): <span className="underline decoration-1 underline-offset-4 font-semibold">{params.datas}</span>
          </p>
        </div>

        {/* Rodapé e Assinaturas */}
        <div className="mt-16 space-y-16">
          <p className="text-right text-base">
            Campos dos Goytacazes, <strong>{params.dia}</strong> de <strong>{params.mes}</strong> de <strong>{params.ano}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-8 text-center pt-8">
            <div className="space-y-1">
              <div className="border-t border-black mx-auto w-[85%] pt-2" />
              <p className="text-xs font-bold uppercase">Orientador Pedagógico / PSP</p>
              <p className="text-[10px] text-gray-500 font-sans">(Assinatura e Matrícula)</p>
            </div>
            <div className="space-y-1">
              <div className="border-t border-black mx-auto w-[85%] pt-2" />
              <p className="text-xs font-bold uppercase">Diretora da Unidade Escolar</p>
              <p className="text-[10px] text-gray-500 font-sans">(Assinatura e Matrícula)</p>
            </div>
          </div>
        </div>

      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 2.5cm 2cm 2.5cm 2cm;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-family: 'Times New Roman', Times, serif !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Garantir que as assinaturas fiquem bem posicionadas e não quebrem página */
          .print\\:aspect-auto {
            aspect-ratio: auto !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          /* Corrigir quebras de linha */
          p, div {
            orphans: 3;
            widows: 3;
          }
        }
      `}</style>
    </div>
  );
}

import React from "react";

// Brasão oficial de Campos dos Goytacazes
export const BRASAO_URL = "https://upload.wikimedia.org/wikipedia/commons/2/23/Bras%C3%A3o_de_Campos_dos_Goytacazes.png";

// Logo JG da escola
export const LOGO_JG_URL = "https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png";

// ─── Estilos CSS para os HTMLs estáticos gerados por pop-up ──────────────────
export const CABECALHO_CSS = `
  /* Estilo do Cabeçalho Timbrado Unificado */
  .timbrado-header {
    width: 100%;
    margin: 0 auto 12px auto;
    box-sizing: border-box;
    background-color: #fff;
    color: #000;
  }

  .timbrado-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 12px;
  }

  .timbrado-brasao-container {
    flex: 0 0 auto;
  }

  .timbrado-brasao {
    height: 60px;
    width: auto;
    object-fit: contain;
    display: block;
  }

  .timbrado-seduct-info {
    text-align: right;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #475569;
    line-height: 1.3;
    font-weight: bold;
    text-transform: uppercase;
  }

  .timbrado-seduct-info p {
    margin: 0;
  }

  .timbrado-divider {
    border: 0;
    border-top: 2px solid #000000;
    margin: 8px 0;
    width: 100%;
  }

  .timbrado-bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 12px;
  }

  .timbrado-school-info {
    text-align: left;
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5pt;
    color: #000000;
    line-height: 1.4;
  }

  .timbrado-school-info p {
    margin: 1.5px 0;
  }

  .timbrado-logo-container {
    flex: 0 0 auto;
  }

  .timbrado-logo {
    height: 65px;
    width: auto;
    object-fit: contain;
    display: block;
  }

  /* Bloco de Título Dinâmico */
  .timbrado-document-title {
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    text-decoration: underline;
    margin: 14px 0 12px 0;
    line-height: 1.3;
    letter-spacing: 0.5px;
  }

  /* Bloco de informações dinâmicas das listagens */
  .timbrado-info-dinamica {
    margin-top: 6px;
    font-size: 10px;
    border-top: 1px dashed #cbd5e1;
    padding-top: 4px;
    font-family: Arial, Helvetica, sans-serif;
    text-transform: uppercase;
    font-weight: bold;
  }

  .timbrado-info-dinamica span {
    margin-right: 18px;
    display: inline-block;
  }

  @media print {
    .timbrado-header {
      background-color: transparent !important;
    }
    .timbrado-seduct-info {
      color: #000000 !important;
    }
    .timbrado-divider {
      border-top-color: #000000 !important;
    }
  }
`;

// ─── Gerador de HTML String para uso com window.open ───────────────────────
export function obterCabecalhoHTML(tituloDoc?: string, infoDinamicaHTML?: string): string {
  return `
    <div class="timbrado-header">
      <!-- Linha Superior (Brasão + Secretarias) -->
      <div class="timbrado-top-row">
        <div class="timbrado-brasao-container">
          <img 
            src="${BRASAO_URL}" 
            alt="Brasão de Campos dos Goytacazes" 
            class="timbrado-brasao"
          />
        </div>
        <div class="timbrado-seduct-info">
          <p>Estado do Rio de Janeiro</p>
          <p>Prefeitura Municipal de Campos dos Goytacazes</p>
          <p>Secretaria Municipal de Educação, Ciência e Tecnologia</p>
        </div>
      </div>
      
      <hr class="timbrado-divider" />
      
      <!-- Linha Inferior (Dados da Escola + Logo JG) -->
      <div class="timbrado-bottom-row">
        <div class="timbrado-school-info">
          <p><strong>Unidade Escolar:</strong> Escola Municipal José Giró Faísca</p>
          <p><strong>Endereço:</strong> Rua São José s/nº, Travessão de Campos – Campos dos Goytacazes – RJ</p>
          <p><strong>Código do INEP:</strong> 33011966 &nbsp;&nbsp;&nbsp;&nbsp; <strong>Telefone Institucional:</strong> (22) 98131-0965</p>
          <p><strong>E-mail Institucional:</strong> em.josegirofaisca@edu.campos.rj.gov.br</p>
          ${infoDinamicaHTML ? `<div class="timbrado-info-dinamica">${infoDinamicaHTML}</div>` : ""}
        </div>
        <div class="timbrado-logo-container">
          <img 
            src="${LOGO_JG_URL}" 
            alt="Logo E. M. José Giró Faísca" 
            class="timbrado-logo"
          />
        </div>
      </div>

      <!-- Título do Documento -->
      ${tituloDoc ? `<div class="timbrado-document-title">${tituloDoc}</div>` : ""}
    </div>
  `;
}

// ─── Componente React para uso inline no sistema ───────────────────────────
interface CabecalhoTimbradoProps {
  tituloDoc?: string;
  infoDinamica?: React.ReactNode;
  className?: string;
}

export function CabecalhoTimbrado({ tituloDoc, infoDinamica, className = "" }: CabecalhoTimbradoProps) {
  return (
    <div className={`timbrado-header print:bg-transparent ${className}`} style={{ width: "100%", backgroundColor: "#fff", color: "#000" }}>
      {/* Estilos injetados para garantir fidelidade no HTML inline e na impressão */}
      <style dangerouslySetInnerHTML={{ __html: CABECALHO_CSS }} />
      
      {/* Linha Superior (Brasão + Secretarias) */}
      <div className="timbrado-top-row flex justify-between items-center w-full gap-3">
        <div className="timbrado-brasao-container shrink-0">
          <img 
            src={BRASAO_URL} 
            alt="Brasão de Campos dos Goytacazes" 
            className="timbrado-brasao h-[60px] w-auto object-contain block"
          />
        </div>
        <div className="timbrado-seduct-info text-right font-sans text-[10pt] text-slate-600 font-bold uppercase leading-tight print:text-black">
          <p className="m-0">Estado do Rio de Janeiro</p>
          <p className="m-0">Prefeitura Municipal de Campos dos Goytacazes</p>
          <p className="m-0">Secretaria Municipal de Educação, Ciência e Tecnologia</p>
        </div>
      </div>
      
      <hr className="timbrado-divider border-0 border-t-2 border-black my-2 w-full print:border-black" />
      
      {/* Linha Inferior (Dados da Escola + Logo JG) */}
      <div className="timbrado-bottom-row flex justify-between items-center w-full gap-3">
        <div className="timbrado-school-info text-left font-serif text-[10.5pt] text-black leading-normal">
          <p className="my-[1.5px] mx-0"><strong>Unidade Escolar:</strong> Escola Municipal José Giró Faísca</p>
          <p className="my-[1.5px] mx-0"><strong>Endereço:</strong> Rua São José s/nº, Travessão de Campos – Campos dos Goytacazes – RJ</p>
          <p className="my-[1.5px] mx-0"><strong>Código do INEP:</strong> 33011966 &nbsp;&nbsp;&nbsp;&nbsp; <strong>Telefone Institucional:</strong> (22) 98131-0965</p>
          <p className="my-[1.5px] mx-0"><strong>E-mail Institucional:</strong> em.josegirofaisca@edu.campos.rj.gov.br</p>
          {infoDinamica && <div className="timbrado-info-dinamica mt-1.5 pt-1 border-t border-dashed border-slate-300 font-sans text-[10px] font-bold uppercase">{infoDinamica}</div>}
        </div>
        <div className="timbrado-logo-container shrink-0">
          <img 
            src={LOGO_JG_URL} 
            alt="Logo E. M. José Giró Faísca" 
            className="timbrado-logo h-[65px] w-auto object-contain block"
          />
        </div>
      </div>

      {/* Título do Documento */}
      {tituloDoc && (
        <div className="timbrado-document-title text-center font-sans text-[14pt] font-bold uppercase underline mt-3.5 mb-3 leading-normal tracking-wide">
          {tituloDoc}
        </div>
      )}
    </div>
  );
}

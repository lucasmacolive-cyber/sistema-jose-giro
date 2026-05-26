import React from "react";

// Brasão oficial de Campos dos Goytacazes
export const BRASAO_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAABy1BMVEVHcExJVEkqKjNATkohFiUdHSw9OTcoJzFWVkYcFR1EVFCsl1pEbGW8pU1DWlZFX1mfn589o05GbFllX0uGcESjV0tCa1w9eFJDa2E9k0+ijFi2trV4bExCXVWvhjmzs7KijEI7XFurlUBwZ1u+vr5/fX5AhVNMYVmXfUONjIw8kEi7oj5/d2BocVyko6JdV0uxMi51W005iEaKUEi6fXSfOTOMOzaghUmniEOtMSyWlZXy8O83NG3cLyk8OXdFdG03NHPLzMvtz0npy0v19fRGcGnOz8/WoDrkx1DT09Lu7uzp6uffw1I/P3j42j/x0kVDRXpFa2bcv1bW19bz8vHXu1jNsV/IrWLk5ePTtlv11kJGenLCp2WOfWulkkVAZmFHTHzTuES3oEiwmkd1aT+5oGjEq1Daoznc3dt/cUH7+vmHd0GcikMxLm7ixkKOfj793z6HkWTav0XBqELJsEKWgkR8blvg4d/Ns09rYEPFxcWsq6orKWsmI2mEdmc1XFqThVRKSWjjuT09s09/gYjLmDhXVGvqvjw7cGo+PmYjHluUkpN8hFxxcH84Nlm9kDhdb2J5fFqLfE6/WUzEMCtkYG1WUDvSdGKiZFVxT56LAAAAlXRSTlMARjltEitNH1wJg/7u/aOS/v6wd6P+yP3b/f3+id366LLByf38lfj9yavH2thuzTDoxI75/aVw44/K0/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////7//vcywyMAABeDSURBVHicxVuJXxLb+wYXQBYR9z23LC2zve7FGp1hDBUhRkABG5xhRBEEZRNERXPJJUvttvy5v/cMi0CpmH6+v/fej1kM53nmOe92zpwRCP5XJv6fIf3Zisv+f/H7pejn/yOJXjQDomsSKOZ/SvpvAV/cDT/6i0uu9aU+EliXlJNVF3xe1Pe6rQOs7bWk9KqxnlbCj9riazliFWkUC2pJzPgn2uKqDoYw2PRL+qUlvd7mC3VILpW3QSQQCOt4LQueBjlJCmoxI1n5+0eSDgY3gAG0njf4HWfaii4cS9gAd1EnQb+Krp4G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";

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
        <div className="timbrado-seduct-info text-right font-sans text-[10pt] text-slate-600 font-bold leading-tight print:text-black">
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

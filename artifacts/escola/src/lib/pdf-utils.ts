/**
 * pdf-utils.ts
 * 
 * Utilitário para geração correta de PDFs com html2pdf.js
 *
 * PROBLEMA: O html2canvas (usado pelo html2pdf) requer que o elemento esteja
 * inserido no DOM para capturar o conteúdo. Elementos criados com 
 * document.createElement() mas não adicionados ao body resultam em PDF vazio.
 *
 * SOLUÇÃO: Esta função insere o elemento temporariamente no DOM (fixo, 
 * fora da área visível), gera o PDF, e remove o elemento.
 */

import html2pdf from "html2pdf.js";

export interface PdfOpcoes {
  margin?: any;
  filename?: string;
  image?: any;
  html2canvas?: Record<string, unknown>;
  jsPDF?: any;
}

/**
 * Gera um PDF a partir de um elemento HTML e retorna como Blob.
 * Insere o elemento no DOM temporariamente para garantir renderização correta.
 */
export async function gerarPdfBlob(
  elemento: HTMLElement,
  opcoes: PdfOpcoes
): Promise<Blob> {
  // Aplica estilos para tornar o elemento presente no DOM mas invisível ao usuário
  elemento.style.position = "fixed";
  elemento.style.left = "-9999px";
  elemento.style.top = "0";
  elemento.style.zIndex = "-9999";
  elemento.style.width = "1400px";
  elemento.style.background = "#fff";
  elemento.style.visibility = "hidden";
  elemento.style.pointerEvents = "none";

  // Insere no DOM
  document.body.appendChild(elemento);

  try {
    // Aguarda o browser aplicar os estilos e carregar recursos
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    const opcoesFinais = {
      margin: 10,
      filename: "documento.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      ...opcoes,
    };

    const blob: Blob = await html2pdf()
      .set(opcoesFinais)
      .from(elemento)
      .outputPdf("blob");

    return blob;
  } finally {
    // Sempre remove o elemento do DOM após gerar (mesmo em caso de erro)
    if (elemento.parentNode) {
      document.body.removeChild(elemento);
    }
  }
}

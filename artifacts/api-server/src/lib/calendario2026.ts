/**
 * Calendário Letivo 2026 — E. M. José Giró Faísca
 * Secretaria Municipal de Educação de Campos dos Goytacazes
 *
 * Conjunto de datas NÃO-LETIVAS que devem ser excluídas de qualquer
 * documento gerado pelo sistema (Pré-Diário, frequências, etc.).
 *
 * Inclui: feriados (F), recessos (R) e férias (FER) — exceto fins de semana
 * que já são filtrados pela lógica de dia-da-semana.
 *
 * Formato das chaves: "DD/MM/YYYY"
 */

export type TipoAusencia = "ferias" | "feriado" | "recesso";

export interface DiaNaoLetivo {
  tipo: TipoAusencia;
  descricao: string;
}

// Mapeamento completo de datas não-letivas (dias úteis apenas)
export const DIAS_NAO_LETIVOS_2026: Record<string, DiaNaoLetivo> = {

  // ── JANEIRO (férias escolares — mês inteiro) ─────────────────────────────
  // Gerado dinamicamente abaixo para todos os dias úteis de janeiro

  // ── FEVEREIRO ─────────────────────────────────────────────────────────────
  "16/02/2026": { tipo: "recesso", descricao: "Recesso de Carnaval" },
  "17/02/2026": { tipo: "recesso", descricao: "Recesso de Carnaval" },
  "18/02/2026": { tipo: "recesso", descricao: "Recesso de Carnaval" },
  "19/02/2026": { tipo: "recesso", descricao: "Recesso de Carnaval" },
  "20/02/2026": { tipo: "recesso", descricao: "Recesso de Carnaval" },

  // ── ABRIL ─────────────────────────────────────────────────────────────────
  "03/04/2026": { tipo: "feriado", descricao: "Paixão de Cristo" },
  "21/04/2026": { tipo: "feriado", descricao: "Tiradentes" },
  "23/04/2026": { tipo: "feriado", descricao: "São Jorge" },
  "24/04/2026": { tipo: "recesso", descricao: "Recesso (ponte São Jorge)" },

  // ── MAIO ──────────────────────────────────────────────────────────────────
  "01/05/2026": { tipo: "feriado", descricao: "Dia do Trabalhador" },

  // ── JUNHO ─────────────────────────────────────────────────────────────────
  "04/06/2026": { tipo: "feriado", descricao: "Corpus Christi" },
  "05/06/2026": { tipo: "recesso", descricao: "Recesso (ponte Corpus Christi)" },

  // ── JULHO (recesso de meio de ano) ────────────────────────────────────────
  "13/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "14/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "15/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "16/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "17/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "20/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "21/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "22/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "23/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },
  "24/07/2026": { tipo: "recesso", descricao: "Recesso Escolar de Julho" },

  // ── AGOSTO ────────────────────────────────────────────────────────────────
  "06/08/2026": { tipo: "feriado", descricao: "Santíssimo Salvador" },

  // ── SETEMBRO ──────────────────────────────────────────────────────────────
  "07/09/2026": { tipo: "feriado", descricao: "Independência do Brasil" },

  // ── OUTUBRO ───────────────────────────────────────────────────────────────
  "12/10/2026": { tipo: "feriado", descricao: "N. Sra. Aparecida" },
  "15/10/2026": { tipo: "recesso", descricao: "Recesso (ponte N. Sra. Aparecida)" },

  // ── NOVEMBRO ──────────────────────────────────────────────────────────────
  "02/11/2026": { tipo: "feriado", descricao: "Finados" },
  // 15/11 cai num domingo — não afeta dias úteis
  "20/11/2026": { tipo: "feriado", descricao: "Dia Nacional da Consciência Negra" },

  // ── DEZEMBRO (recesso de Natal) ───────────────────────────────────────────
  "21/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "22/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "23/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "24/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "25/12/2026": { tipo: "feriado", descricao: "Natal" },
  "28/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "29/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "30/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
  "31/12/2026": { tipo: "recesso", descricao: "Recesso de Natal" },
};

// Adicionar todos os dias úteis de janeiro (férias)
for (let dia = 1; dia <= 31; dia++) {
  const d = new Date(2026, 0, dia); // mês 0 = janeiro
  if (d.getMonth() !== 0) break;   // segurança
  const dow = d.getDay();
  if (dow !== 0 && dow !== 6) {    // apenas dias úteis
    const chave = `${String(dia).padStart(2, "0")}/01/2026`;
    DIAS_NAO_LETIVOS_2026[chave] = { tipo: "ferias", descricao: "Férias Escolares" };
  }
}

/**
 * Retorna true se a data (no formato "DD/MM/YYYY") é um dia letivo válido:
 * - Não é fim de semana
 * - Não é feriado, recesso nem férias do calendário 2026
 */
export function isDiaLetivo(dataDDMMYYYY: string): boolean {
  const [dd, mm, yyyy] = dataDDMMYYYY.split("/").map(Number);
  if (!dd || !mm || !yyyy) return false;
  const d = new Date(yyyy, mm - 1, dd);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;              // sábado / domingo
  return !(dataDDMMYYYY in DIAS_NAO_LETIVOS_2026);       // feriado / recesso / férias
}

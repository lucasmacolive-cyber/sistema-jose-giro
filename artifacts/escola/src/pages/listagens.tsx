import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMe } from "@workspace/api-client-react";
import { Loader2, FileSpreadsheet, LayoutList, Rows3, Download, UserCircle, Users, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* Todas as colunas começam DESMARCADAS — usuário escolhe o que quer */
const COLUNAS_DISPONIVEIS = [
  { ref: "matricula",         label: "Matrícula" },
  { ref: "cpf",               label: "CPF" },
  { ref: "cpfResponsavel",    label: "CPF do Responsável" },
  { ref: "dataNascimento",    label: "Data de Nascimento" },
  { ref: "emailPessoal",      label: "Email Pessoal" },
  { ref: "emailResponsavel",  label: "Email do Responsável" },
  { ref: "endereco",          label: "Endereço" },
  { ref: "etnia",             label: "Etnia/Raça" },
  { ref: "nomeMae",           label: "Nome da Mãe" },
  { ref: "nomePai",           label: "Nome do Pai" },
  { ref: "nivelEnsino",       label: "Nível de Ensino" },
  { ref: "rg",                label: "RG" },
  { ref: "responsavel",       label: "Responsável" },
  { ref: "sexo",              label: "Sexo" },
  { ref: "telefone",          label: "Telefone" },
  { ref: "zonaResidencial",   label: "Zona Residencial" },
  { ref: "_assinatura",       label: "Campo para Assinatura" },
];

const COLUNAS_PROF = [
  { ref: "matricula",           label: "Matrícula" },
  { ref: "cargo",               label: "Cargo" },
  { ref: "turmaManha",          label: "Turma Manhã" },
  { ref: "turmaTarde",          label: "Turma Tarde" },
  { ref: "turno",               label: "Turno" },
  { ref: "telefone",            label: "Telefone" },
  { ref: "email",               label: "E-mail" },
  { ref: "cpf",                 label: "CPF" },
  { ref: "vinculo",             label: "Vínculo" },
  { ref: "jornada",             label: "Jornada" },
  { ref: "titulacao",           label: "Titulação" },
  { ref: "dataNascimento",      label: "Data de Nascimento" },
  { ref: "identificacaoCenso",  label: "Identificação Censo" },
  { ref: "_assinatura",         label: "Campo para Assinatura" },
];

const COLUNAS_FUNC = [
  { ref: "matricula",         label: "Matrícula" },
  { ref: "funcao",            label: "Função" },
  { ref: "turno",             label: "Turno" },
  { ref: "telefoneContato",   label: "Telefone" },
  { ref: "cpf",               label: "CPF" },
  { ref: "vinculo",           label: "Vínculo" },
  { ref: "dataAdmissao",      label: "Data de Admissão" },
  { ref: "status",            label: "Status" },
  { ref: "contatoEmergencia", label: "Contato de Emergência" },
  { ref: "_assinatura",       label: "Campo para Assinatura" },
];

type Orientacao = "retrato" | "paisagem";

/* ── HTML genérico para lista de pessoas ─────────────────────────── */
function gerarHtmlLista(
  titulo: string,
  _subtitulo: string,
  nomeCol: string,
  nomeField: string,
  pessoas: Record<string, string>[],
  colunas: { ref: string; label: string }[],
  orientacao: Orientacao,
): string {
  const hoje    = new Date().toLocaleDateString("pt-BR");
  const pgSize  = orientacao === "paisagem" ? "A4 landscape" : "A4 portrait";
  const fsBody  = orientacao === "paisagem" ? "11px" : "10px";
  const colsAll = [{ label: "Nº", ref: "_n" }, { label: nomeCol, ref: "_nome" }, ...colunas];
  const ths     = colsAll.map(c => `<th style="background:#f0f4f8;padding:6px 8px;border-bottom:2px solid #cbd5e1;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">${c.label}</th>`).join("");

  const linhas = pessoas.map((p, i) => {
    const cells = colsAll.map(c => {
      let v = "";
      if (c.ref === "_n")               v = String(i + 1);
      else if (c.ref === "_nome")        v = (p as any)[nomeField] || "";
      else if (c.ref === "_assinatura")  v = "_________________________";
      else                               v = (p as any)[c.ref] || "";
      return `<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:${fsBody};">${v}</td>`;
    }).join("");
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">${cells}</tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
  <style>
    @page{size:${pgSize};margin:1.8cm}
    body{font-family:Arial,sans-serif;font-size:${fsBody};color:#1e293b}
    .no-print{margin-bottom:14px;display:flex;gap:8px}
    .no-print button{padding:7px 18px;cursor:pointer;border:none;border-radius:6px;font-weight:700;font-size:13px}
    .btn-imp{background:#2563eb;color:#fff}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    h2{font-size:15pt;margin:0 0 2px}p.sub{margin:0;font-size:9pt;color:#64748b}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="no-print">
    <button class="btn-imp" onclick="window.print()">🖨️ IMPRIMIR / SALVAR PDF</button>
  </div>
  <div style="border-left:4px solid #3b82f6;padding-left:12px;margin-bottom:14px">
    <p style="font-size:7pt;margin:0;color:#64748b">PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES · SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA</p>
    <h2>E. M. JOSÉ GIRÓ FAÍSCA</h2>
    <p class="sub">${titulo} · ${pessoas.length} registro${pessoas.length !== 1 ? "s" : ""} · Emitido em ${hoje}</p>
  </div>
  <table><thead><tr>${ths}</tr></thead><tbody>${linhas}</tbody></table>
  </body></html>`;
}

/* ── HTML para TODAS as turmas (uma por página) ───────────────────────── */
function gerarHtmlTodasTurmas(
  turmasList: { nomeTurma: string; professorResponsavel?: string }[],
  alunosPorTurma: Record<string, Record<string, string>[]>,
  colunasSelecionadas: { ref: string; label: string }[],
  showProfessor: boolean,
  showTurma: boolean,
  orientacao: Orientacao
) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const pageSize = orientacao === "paisagem" ? "A4 landscape" : "A4 portrait";
  const fontSize = orientacao === "paisagem" ? "11px" : "10px";
  const colunas = [
    { label: "Nº",            ref: "_n" },
    { label: "Nome do Aluno", ref: "nomeCompleto" },
    ...colunasSelecionadas,
  ];

  const tabelaPorTurma = turmasList
    .filter((t) => (alunosPorTurma[t.nomeTurma] ?? []).length > 0)
    .map((t, idx, arr) => {
      const alunos = alunosPorTurma[t.nomeTurma] ?? [];
      const professor = t.professorResponsavel ?? "";
      const linhas = alunos
        .map((a, i) => `<tr>${colunas.map((c) => {
          if (c.ref === "_n") return `<td>${i + 1}</td>`;
          if (c.ref === "_assinatura") return `<td style="color:#ccc">_______________________</td>`;
          return `<td>${(a as any)[c.ref] || ""}</td>`;
        }).join("")}</tr>`)
        .join("");
      const isLast = idx === arr.length - 1;
      return `
        <div class="turma-bloco${isLast ? "" : " page-break"}">
          <div class="cabecalho-container">
            <div class="textos-prefeitura">
              <p>Prefeitura do Município de Campos dos Goytacazes</p>
              <p>Secretaria Municipal de Educação, Ciência e Tecnologia</p>
              <p>E. M. José Giró Faísca</p>
              <div class="info-dinamica">
                ${showProfessor && professor ? `<span>PROFESSOR(A): ${professor}</span>` : ""}
                ${showTurma ? `<span>TURMA: ${t.nomeTurma}</span>` : ""}
                <span>EMISSÃO: ${hoje}</span>
              </div>
            </div>
            <img src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" class="logo-escola" alt="Logo Escola">
          </div>
          <table>
            <thead><tr>${colunas.map((c) => `<th>${c.label.toUpperCase()}</th>`).join("")}</tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Listagem — Todas as Turmas</title>
  <style>
    @page { size: ${pageSize}; margin: 15mm 12mm; }
    body { font-family: Arial, sans-serif; padding: 0; color: #000; background: white; }
    .no-print { display: flex; gap: 10px; margin-bottom: 16px; padding: 10px; background: #f0f0f0; border-radius: 5px; border: 1px solid #ccc; }
    button { padding: 10px 20px; cursor: pointer; font-weight: bold; border-radius: 5px; border: 1px solid #000; }
    .btn-imp { background: #10b981; color: #fff; border: none; }
    .cabecalho-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; margin-bottom: 14px; padding-bottom: 12px; }
    .textos-prefeitura p { margin: 2px 0; font-weight: bold; text-transform: uppercase; font-size: 12px; }
    .logo-escola { width: 80px; height: 80px; object-fit: contain; }
    .info-dinamica { margin-top: 8px; font-size: 11px; border-top: 1px solid #eee; padding-top: 4px; }
    .info-dinamica span { font-weight: bold; text-transform: uppercase; margin-right: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: auto; }
    th, td { border: 1px solid #000; padding: 5px 6px; font-size: ${fontSize}; text-align: left; word-wrap: break-word; }
    th { background: #f2f2f2; text-transform: uppercase; font-weight: bold; }
    .turma-bloco { margin-bottom: 8px; }
    .page-break { page-break-after: always; margin-bottom: 0; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-imp" onclick="window.print()">🖨️ CONFIRMAR E IMPRIMIR</button>
    <span style="line-height:38px;font-size:12px;color:#555;">
      Todas as turmas — ${turmasList.filter((t) => (alunosPorTurma[t.nomeTurma] ?? []).length > 0).length} turmas |
      Orientação: <strong>${orientacao === "paisagem" ? "📄 Paisagem" : "📄 Retrato"}</strong>
    </span>
  </div>
  ${tabelaPorTurma}
</body>
</html>`;
}

function gerarHtmlImpressao(
  turma: string,
  alunos: Record<string, string>[],
  colunasSelecionadas: { ref: string; label: string }[],
  professor: string,
  showProfessor: boolean,
  showTurma: boolean,
  orientacao: Orientacao
) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const colunas = [
    { label: "Nº",            ref: "_n" },
    { label: "Nome do Aluno", ref: "nomeCompleto" },
    ...colunasSelecionadas,
  ];

  const pageSize = orientacao === "paisagem" ? "A4 landscape" : "A4 portrait";
  /* Em paisagem a tabela tem mais espaço horizontal → fonte um pouco maior */
  const fontSize = orientacao === "paisagem" ? "11px" : "10px";

  const linhasTabela = alunos
    .map(
      (a, i) => `
      <tr>
        ${colunas
          .map((c) => {
            if (c.ref === "_n")          return `<td>${i + 1}</td>`;
            if (c.ref === "_assinatura") return `<td style="color:#ccc">_______________________</td>`;
            return `<td>${(a as any)[c.ref] || ""}</td>`;
          })
          .join("")}
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Lista - ${turma}</title>
  <style>
    @page { size: ${pageSize}; margin: 15mm 12mm; }
    body { font-family: Arial, sans-serif; padding: 0; color: #000; background: white; }
    .no-print { display: flex; gap: 10px; margin-bottom: 16px; padding: 10px; background: #f0f0f0; border-radius: 5px; border: 1px solid #ccc; }
    button { padding: 10px 20px; cursor: pointer; font-weight: bold; border-radius: 5px; border: 1px solid #000; }
    .btn-imp { background: #10b981; color: #fff; border: none; }
    .cabecalho-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; margin-bottom: 14px; padding-bottom: 12px; }
    .textos-prefeitura p { margin: 2px 0; font-weight: bold; text-transform: uppercase; font-size: 12px; }
    .logo-escola { width: 80px; height: 80px; object-fit: contain; }
    .info-dinamica { margin-top: 8px; font-size: 11px; border-top: 1px solid #eee; padding-top: 4px; }
    .info-dinamica span { font-weight: bold; text-transform: uppercase; margin-right: 18px; }
    .orientacao-badge { display:inline-block; margin-left:8px; font-size:10px; color:#666; border:1px solid #ccc; border-radius:3px; padding:1px 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: auto; }
    th, td { border: 1px solid #000; padding: 5px 6px; font-size: ${fontSize}; text-align: left; word-wrap: break-word; }
    th { background: #f2f2f2; text-transform: uppercase; font-weight: bold; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 0; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-imp" onclick="window.print()">🖨️ CONFIRMAR E IMPRIMIR</button>
    <span style="line-height:38px;font-size:12px;color:#555;">
      Orientação: <strong>${orientacao === "paisagem" ? "📄 Paisagem (Landscape)" : "📄 Retrato (Portrait)"}</strong>
    </span>
  </div>
  <div class="cabecalho-container">
    <div class="textos-prefeitura">
      <p>Prefeitura do Município de Campos dos Goytacazes</p>
      <p>Secretaria Municipal de Educação, Ciência e Tecnologia</p>
      <p>E. M. José Giró Faísca</p>
      <div class="info-dinamica">
        ${showProfessor && professor ? `<span>PROFESSOR(A): ${professor}</span>` : ""}
        ${showTurma ? `<span>TURMA: ${turma}</span>` : ""}
        <span>EMISSÃO: ${hoje}</span>
      </div>
    </div>
    <img src="https://i.postimg.cc/bwn72w4F/So-logo-sem-fundo.png" class="logo-escola" alt="Logo Escola">
  </div>
  <table>
    <thead><tr>${colunas.map((c) => `<th>${c.label.toUpperCase()}</th>`).join("")}</tr></thead>
    <tbody>${linhasTabela}</tbody>
  </table>
</body>
</html>`;
}

export default function ListagensPage() {
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";

  const [turmaSelecionada, setTurmaSelecionada]   = useState("");
  const [showProfessor, setShowProfessor]         = useState(false);
  const [showTurma, setShowTurma]                 = useState(false);
  const [orientacao, setOrientacao]               = useState<Orientacao>("retrato");
  /* Todas desmarcadas por padrão */
  const [colunasMarcadas, setColunasMarcadas]     = useState<Record<string, boolean>>(
    () => Object.fromEntries(COLUNAS_DISPONIVEIS.map((c) => [c.ref, false]))
  );
  const [gerando,   setGerando]   = useState(false);
  const [baixando,  setBaixando]  = useState(false);
  const [exportando, setExportando] = useState(false);
  const [imprimindoRicoh, setImprimindoRicoh] = useState(false);

  const turmaObj = turmas?.find((t) => t.nomeTurma === turmaSelecionada);
  const qtdMarcadas = Object.values(colunasMarcadas).filter(Boolean).length;

  function toggleColuna(ref: string) {
    setColunasMarcadas((prev) => ({ ...prev, [ref]: !prev[ref] }));
  }

  function desmarcarTodas() {
    setColunasMarcadas(Object.fromEntries(COLUNAS_DISPONIVEIS.map((c) => [c.ref, false])));
  }

  const isTransferidos = turmaSelecionada === "__transferidos__";
  const isTodasTurmas  = turmaSelecionada === "__todas__";

  type ColDef = { ref: string; label: string };
  type TurmaData = { nomeTurma: string; professorResponsavel: string; alunos: Record<string, string>[] };
  type ListData  = { blocos: TurmaData[]; colunas: ColDef[]; titulo: string };

  /* ── Busca os dados (compartilhado entre HTML e PDF) ─────────────── */
  async function fetchData(): Promise<ListData | null> {
    if (!turmaSelecionada) {
      alert("Por favor, selecione uma turma primeiro!");
      return null;
    }

    /* todas as turmas */
    if (isTodasTurmas) {
      if (!turmas || turmas.length === 0) { alert("Nenhuma turma encontrada."); return null; }
      const colunas = COLUNAS_DISPONIVEIS.filter((c) => colunasMarcadas[c.ref]);
      const blocos: TurmaData[] = [];
      await Promise.all(
        turmas.map(async (t) => {
          const r = await fetch(`${BASE}/api/alunos?turma=${encodeURIComponent(t.nomeTurma)}`, { credentials: "include" });
          const alunos = await r.json();
          blocos.push({ nomeTurma: t.nomeTurma, professorResponsavel: t.professorResponsavel ?? "", alunos: Array.isArray(alunos) ? alunos : [] });
        })
      );
      blocos.sort((a, b) => a.nomeTurma.localeCompare(b.nomeTurma));
      return { blocos, colunas, titulo: "Todas_as_Turmas" };
    }

    /* turma única ou transferidos */
    const url = isTransferidos
      ? `${BASE}/api/alunos?transferidos=true`
      : `${BASE}/api/alunos?turma=${encodeURIComponent(turmaSelecionada)}`;
    const res    = await fetch(url, { credentials: "include" });
    const alunos = await res.json();

    if (!alunos || alunos.length === 0) {
      alert(isTransferidos ? "Nenhum aluno transferido encontrado." : `Nenhum aluno encontrado para a turma ${turmaSelecionada}.`);
      return null;
    }

    const colunas: ColDef[] = isTransferidos
      ? [
          { ref: "turmaAtual",        label: "Turma Atual" },
          { ref: "turmaOrigem",       label: "Turma de Origem" },
          { ref: "tipoTransferencia", label: "Tipo" },
          { ref: "dataTransferencia", label: "Data" },
          ...COLUNAS_DISPONIVEIS.filter((c) => colunasMarcadas[c.ref]),
        ]
      : COLUNAS_DISPONIVEIS.filter((c) => colunasMarcadas[c.ref]);

    const professor = turmaObj?.professorResponsavel ?? "";
    const titulo    = isTransferidos ? "Transferidos" : turmaSelecionada.replace(/\s+/g, "_");
    return {
      blocos: [{ nomeTurma: isTransferidos ? "Alunos Transferidos" : turmaSelecionada, professorResponsavel: professor, alunos }],
      colunas,
      titulo,
    };
  }

  /* ── Gerar (HTML, nova aba) ──────────────────────────────────────── */
  async function gerarListagem() {
    setGerando(true);
    try {
      const data = await fetchData();
      if (!data) return;

      let html: string;
      if (isTodasTurmas) {
        const alunosPorTurma: Record<string, Record<string, string>[]> = {};
        data.blocos.forEach((b) => { alunosPorTurma[b.nomeTurma] = b.alunos; });
        html = gerarHtmlTodasTurmas(
          turmas ?? [],
          alunosPorTurma,
          data.colunas,
          showProfessor,
          showTurma,
          orientacao
        );
      } else {
        const b = data.blocos[0];
        html = gerarHtmlImpressao(
          b.nomeTurma,
          b.alunos,
          data.colunas,
          b.professorResponsavel,
          isTransferidos ? false : showProfessor,
          isTransferidos ? false : showTurma,
          orientacao
        );
      }

      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } finally {
      setGerando(false);
    }
  }

  async function imprimirListaNaRicoh() {
    setImprimindoRicoh(true);
    try {
      const data = await fetchData();
      if (!data) return;

      let html: string;
      if (isTodasTurmas) {
        const alunosPorTurma: Record<string, Record<string, string>[]> = {};
        data.blocos.forEach((b) => { alunosPorTurma[b.nomeTurma] = b.alunos; });
        html = gerarHtmlTodasTurmas(turmas ?? [], alunosPorTurma, data.colunas, showProfessor, showTurma, orientacao);
      } else {
        const b = data.blocos[0];
        html = gerarHtmlImpressao(b.nomeTurma, b.alunos, data.colunas, b.professorResponsavel, isTransferidos ? false : showProfessor, isTransferidos ? false : showTurma, orientacao);
      }

      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Listagem_${data.titulo}.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${API_BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar para impressora");

      alert("Enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao tentar imprimir diretamente.");
    } finally {
      setImprimindoRicoh(false);
    }
  }

  /* ── Baixar DOC (Word) ───────────────────────────────────────────── */
  async function baixarDoc() {
    setGerando(true); // Usando gerando para o estado visual
    try {
      const data = await fetchData();
      if (!data) return;

      let htmlBody: string;
      if (isTodasTurmas) {
        const alunosPorTurma: Record<string, Record<string, string>[]> = {};
        data.blocos.forEach((b) => { alunosPorTurma[b.nomeTurma] = b.alunos; });
        htmlBody = gerarHtmlTodasTurmas(turmas ?? [], alunosPorTurma, data.colunas, showProfessor, showTurma, orientacao);
      } else {
        const b = data.blocos[0];
        htmlBody = gerarHtmlImpressao(b.nomeTurma, b.alunos, data.colunas, b.professorResponsavel, showProfessor, showTurma, orientacao);
      }

      // Converte HTML para um formato que o Word entende (MHT/HTML com metadados)
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; }</style></head><body>`;
      const footer = "</body></html>";
      const sourceHTML = header + htmlBody + footer;
      
      const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Listagem_${data.titulo}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar arquivo DOC.");
    } finally {
      setGerando(false);
    }
  }

  /* ── Baixar PDF ──────────────────────────────────────────────────── */
  async function baixarPdf() {
    setBaixando(true);
    try {
      const data = await fetchData();
      if (!data) return;

      const hoje    = new Date().toLocaleDateString("pt-BR");
      const orient  = orientacao === "paisagem" ? "landscape" : "portrait";
      const doc     = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });
      const pageW   = doc.internal.pageSize.getWidth();
      const margin  = 12;

      const cabecalhoFonte = (nome: string, prof: string) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES", margin, 10);
        doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA", margin, 14);
        doc.text("E. M. JOSÉ GIRÓ FAÍSCA", margin, 18);
        const infos: string[] = [];
        if (showProfessor && !isTransferidos && prof) infos.push(`PROFESSOR(A): ${prof}`);
        if (showTurma && !isTransferidos) infos.push(`TURMA: ${nome}`);
        infos.push(`EMISSÃO: ${hoje}`);
        doc.setFont("helvetica", "normal");
        doc.text(infos.join("     "), margin, 22);
        doc.setDrawColor(0);
        doc.setLineWidth(0.4);
        doc.line(margin, 24, pageW - margin, 24);
      };

      const colLabels = ["Nº", "Nome do Aluno", ...data.colunas.map((c) => c.label)];

      data.blocos.forEach((bloco, idx) => {
        if (idx > 0) doc.addPage();
        cabecalhoFonte(bloco.nomeTurma, bloco.professorResponsavel);

        const body = bloco.alunos.map((a, i) => [
          String(i + 1),
          a.nomeCompleto || "",
          ...data.colunas.map((c) => {
            if (c.ref === "_assinatura") return "_________________________";
            return (a as any)[c.ref] || "";
          }),
        ]);

        autoTable(doc, {
          head:       [colLabels],
          body,
          startY:     27,
          margin:     { left: margin, right: margin },
          styles:     { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", fontSize: 7.5 },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          tableLineColor: 0,
          tableLineWidth: 0.1,
        });
      });

      const hoje2 = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      doc.save(`Listagem_${data.titulo}_${hoje2}.pdf`);
    } finally {
      setBaixando(false);
    }
  }

  /* ── Baixar Excel ───────────────────────────────────────────────── */
  async function baixarExcel() {
    setExportando(true);
    try {
      const data = await fetchData();
      if (!data) return;

      const hoje  = new Date().toLocaleDateString("pt-BR");
      const wb    = XLSX.utils.book_new();
      const colunas = ["Nº", "Nome do Aluno", ...data.colunas.map((c) => c.label)];

      data.blocos.forEach((bloco) => {
        const linhas: (string | number)[][] = [];

        /* cabeçalho da escola */
        linhas.push(["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"]);
        linhas.push(["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"]);
        linhas.push(["E. M. JOSÉ GIRÓ FAÍSCA"]);
        const info: string[] = [];
        if (showProfessor && !isTransferidos && bloco.professorResponsavel)
          info.push(`PROFESSOR(A): ${bloco.professorResponsavel}`);
        if (showTurma && !isTransferidos) info.push(`TURMA: ${bloco.nomeTurma}`);
        info.push(`EMISSÃO: ${hoje}`);
        linhas.push([info.join("     ")]);
        linhas.push([]); /* linha em branco */

        /* cabeçalho da tabela */
        linhas.push(colunas);

        /* dados */
        bloco.alunos.forEach((a, i) => {
          linhas.push([
            i + 1,
            a.nomeCompleto || "",
            ...data.colunas.map((c) => {
              if (c.ref === "_assinatura") return "_________________________";
              return (a as any)[c.ref] || "";
            }),
          ]);
        });

        /* nome da aba: máx 31 chars (limite do Excel) */
        const nomePlani = bloco.nomeTurma.slice(0, 31).replace(/[\\/?*[\]:]/g, "_");
        const ws = XLSX.utils.aoa_to_sheet(linhas);

        /* largura automática das colunas */
        const colWidths = colunas.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
        colWidths[1] = { wch: 36 }; /* Nome do Aluno mais largo */
        ws["!cols"] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, nomePlani);
      });

      const hoje2 = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      XLSX.writeFile(wb, `Listagem_${data.titulo}_${hoje2}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  async function baixarDocProfessores() {
    setGerandoProf(true);
    try {
      const colLabels = ["Nº", "Nome do Professor", ...COLUNAS_PROF.filter(c => colProf[c.ref]).map(c => c.label)];
      const rows = professores.map((p, i) => [
        i + 1,
        p.nomeCompleto || "",
        ...COLUNAS_PROF.filter(c => colProf[c.ref]).map(c => (p as any)[c.ref] || "")
      ]);

      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; font-family: Arial; font-size: 10pt; }</style></head><body>`;
      let table = "<h2>LISTAGEM DE PROFESSORES - E. M. JOSÉ GIRÓ FAÍSCA</h2><table><tr>";
      colLabels.forEach(l => { table += `<th>${l}</th>`; });
      table += "</tr>";
      rows.forEach(r => {
        table += "<tr>";
        r.forEach(c => { table += `<td>${c}</td>`; });
        table += "</tr>";
      });
      table += "</table></body></html>";

      const blob = new Blob(['\ufeff', header + table], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Listagem_Professores.doc`;
      a.click();
    } finally {
      setGerandoProf(false);
    }
  }

  async function baixarDocFuncionarios() {
    setGerandoFunc(true);
    try {
      const colLabels = ["Nº", "Nome do Funcionário", ...COLUNAS_FUNC.filter(c => colFunc[c.ref]).map(c => c.label)];
      const rows = funcionarios.map((f, i) => [
        i + 1,
        f.nomeCompleto || "",
        ...COLUNAS_FUNC.filter(c => colFunc[c.ref]).map(c => (f as any)[c.ref] || "")
      ]);

      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 5px; font-family: Arial; font-size: 10pt; }</style></head><body>`;
      let table = "<h2>LISTAGEM DE FUNCIONÁRIOS - E. M. JOSÉ GIRÓ FAÍSCA</h2><table><tr>";
      colLabels.forEach(l => { table += `<th>${l}</th>`; });
      table += "</tr>";
      rows.forEach(r => {
        table += "<tr>";
        r.forEach(c => { table += `<td>${c}</td>`; });
        table += "</tr>";
      });
      table += "</table></body></html>";

      const blob = new Blob(['\ufeff', header + table], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Listagem_Funcionarios.doc`;
      a.click();
    } finally {
      setGerandoFunc(false);
    }
  }

  /* ── classes de botão de orientação ── */
  const btnOrientacaoBase =
    "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all";
  const btnAtivo   = "bg-blue-500/20 border-blue-500/50 text-blue-300";
  const btnInativo = "bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/70";

  /* ── Professores ────────────────────────────────────────────────── */
  const { data: professores = [] } = useQuery<any[]>({
    queryKey: ["/api/professores"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/professores`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar professores");
      return r.json();
    },
  });

  const [colProf, setColProf] = useState<Record<string, boolean>>(
    () => Object.fromEntries(COLUNAS_PROF.map(c => [c.ref, false]))
  );
  const [orientProf, setOrientProf] = useState<Orientacao>("retrato");
  const [gerandoProf,   setGerandoProf]   = useState(false);
  const [baixandoProf,  setBaixandoProf]  = useState(false);
  const [exportandoProf, setExportandoProf] = useState(false);

  const qtdProf = Object.values(colProf).filter(Boolean).length;

  async function gerarHtmlProfessores() {
    setGerandoProf(true);
    try {
      const cols = COLUNAS_PROF.filter(c => colProf[c.ref]);
      const html = gerarHtmlLista("Listagem de Professores", "E. M. José Giró Faísca", "Nome do Professor", "nome", professores as any[], cols, orientProf);
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } finally {
      setGerandoProf(false);
    }
  }

  async function imprimirProfNaRicoh() {
    setImprimindoRicoh(true);
    try {
      const cols = COLUNAS_PROF.filter(c => colProf[c.ref]);
      const html = gerarHtmlLista("Listagem de Professores", "E. M. José Giró Faísca", "Nome do Professor", "nome", professores as any[], cols, orientProf);
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Listagem_Professores.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${API_BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar para impressora");
      alert("Enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao imprimir diretamente.");
    } finally {
      setImprimindoRicoh(false);
    }
  }

  function baixarPdfProfessores() {
    setBaixandoProf(true);
    try {
      if (professores.length === 0) { alert("Nenhum professor encontrado."); return; }
      const hoje   = new Date().toLocaleDateString("pt-BR");
      const orient = orientProf === "paisagem" ? "landscape" : "portrait";
      const doc    = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });
      const pw     = doc.internal.pageSize.getWidth();
      const mg     = 12;
      const cols   = COLUNAS_PROF.filter(c => colProf[c.ref]);

      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES", mg, 10);
      doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA", mg, 14);
      doc.text("E. M. JOSÉ GIRÓ FAÍSCA", mg, 18);
      doc.setFont("helvetica", "normal");
      doc.text(`LISTAGEM DE PROFESSORES · ${professores.length} registro(s) · EMISSÃO: ${hoje}`, mg, 22);
      doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(mg, 24, pw - mg, 24);

      autoTable(doc, {
        head: [["Nº", "Nome do Professor", ...cols.map(c => c.label)]],
        body: professores.map((p: any, i) => [
          String(i + 1),
          p.nome || "",
          ...cols.map(c => c.ref === "_assinatura" ? "_________________________" : (p[c.ref] || "")),
        ]),
        startY: 27,
        margin: { left: mg, right: mg },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        columnStyles: { 0: { cellWidth: 10, halign: "center" } },
        tableLineColor: 0, tableLineWidth: 0.1,
      });

      const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      doc.save(`Listagem_Professores_${dataStr}.pdf`);
    } finally {
      setBaixandoProf(false);
    }
  }

  function baixarExcelProfessores() {
    setExportandoProf(true);
    try {
      if (professores.length === 0) { alert("Nenhum professor encontrado."); return; }
      const hoje = new Date().toLocaleDateString("pt-BR");
      const cols = COLUNAS_PROF.filter(c => colProf[c.ref]);
      const linhas: (string | number)[][] = [
        ["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"],
        ["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"],
        ["E. M. JOSÉ GIRÓ FAÍSCA"],
        [`LISTAGEM DE PROFESSORES     EMISSÃO: ${hoje}     ${professores.length} registro(s)`],
        [],
        ["Nº", "Nome do Professor", ...cols.map(c => c.label)],
        ...(professores as any[]).map((p, i) => [
          i + 1,
          p.nome || "",
          ...cols.map(c => c.ref === "_assinatura" ? "_________________________" : (p[c.ref] || "")),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["!cols"] = [{ wch: 6 }, { wch: 36 }, ...cols.map(c => ({ wch: Math.max(c.label.length + 4, 14) }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Professores");
      const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      XLSX.writeFile(wb, `Listagem_Professores_${dataStr}.xlsx`);
    } finally {
      setExportandoProf(false);
    }
  }

  /* ── Funcionários ───────────────────────────────────────────────── */
  const { data: funcionarios = [] } = useQuery<any[]>({
    queryKey: ["/api/funcionarios"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/funcionarios`, { credentials: "include" });
      if (!r.ok) throw new Error("Erro ao carregar funcionários");
      return r.json();
    },
  });

  const [colFunc, setColFunc] = useState<Record<string, boolean>>(
    () => Object.fromEntries(COLUNAS_FUNC.map(c => [c.ref, false]))
  );
  const [orientFunc, setOrientFunc] = useState<Orientacao>("retrato");
  const [gerandoFunc,   setGerandoFunc]   = useState(false);
  const [baixandoFunc,  setBaixandoFunc]  = useState(false);
  const [exportandoFunc, setExportandoFunc] = useState(false);

  const qtdFunc = Object.values(colFunc).filter(Boolean).length;

  async function gerarHtmlFuncionarios() {
    setGerandoFunc(true);
    try {
      const cols = COLUNAS_FUNC.filter(c => colFunc[c.ref]);
      const html = gerarHtmlLista("Listagem de Funcionários", "E. M. José Giró Faísca", "Nome do Funcionário", "nomeCompleto", funcionarios as any[], cols, orientFunc);
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } finally {
      setGerandoFunc(false);
    }
  }

  async function imprimirFuncNaRicoh() {
    setImprimindoRicoh(true);
    try {
      const cols = COLUNAS_FUNC.filter(c => colFunc[c.ref]);
      const html = gerarHtmlLista("Listagem de Funcionários", "E. M. José Giró Faísca", "Nome do Funcionário", "nomeCompleto", funcionarios as any[], cols, orientFunc);
      const blob = new Blob([html], { type: "text/html" });
      const file = new File([blob], `Listagem_Funcionarios.html`, { type: "text/html" });

      const form = new FormData();
      form.append("professorSolicitante", me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", "1");
      form.append("impressoraNome", "RICOH");
      form.append("arquivo", file);

      const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      const res = await fetch(`${API_BASE}api/impressoes`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro ao enviar para impressora");
      alert("Enviado para a RICOH com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao imprimir diretamente.");
    } finally {
      setImprimindoRicoh(false);
    }
  }

  function baixarPdfFuncionarios() {
    setBaixandoFunc(true);
    try {
      if (funcionarios.length === 0) { alert("Nenhum funcionário encontrado."); return; }
      const hoje   = new Date().toLocaleDateString("pt-BR");
      const orient = orientFunc === "paisagem" ? "landscape" : "portrait";
      const doc    = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });
      const pw     = doc.internal.pageSize.getWidth();
      const mg     = 12;
      const cols   = COLUNAS_FUNC.filter(c => colFunc[c.ref]);

      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES", mg, 10);
      doc.text("SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA", mg, 14);
      doc.text("E. M. JOSÉ GIRÓ FAÍSCA", mg, 18);
      doc.setFont("helvetica", "normal");
      doc.text(`LISTAGEM DE FUNCIONÁRIOS · ${funcionarios.length} registro(s) · EMISSÃO: ${hoje}`, mg, 22);
      doc.setDrawColor(0); doc.setLineWidth(0.4); doc.line(mg, 24, pw - mg, 24);

      autoTable(doc, {
        head: [["Nº", "Nome do Funcionário", ...cols.map(c => c.label)]],
        body: (funcionarios as any[]).map((f, i) => [
          String(i + 1),
          f.nomeCompleto || "",
          ...cols.map(c => c.ref === "_assinatura" ? "_________________________" : (f[c.ref] || "")),
        ]),
        startY: 27,
        margin: { left: mg, right: mg },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [240, 253, 249] },
        columnStyles: { 0: { cellWidth: 10, halign: "center" } },
        tableLineColor: 0, tableLineWidth: 0.1,
      });

      const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      doc.save(`Listagem_Funcionarios_${dataStr}.pdf`);
    } finally {
      setBaixandoFunc(false);
    }
  }

  function baixarExcelFuncionarios() {
    setExportandoFunc(true);
    try {
      if (funcionarios.length === 0) { alert("Nenhum funcionário encontrado."); return; }
      const hoje = new Date().toLocaleDateString("pt-BR");
      const cols = COLUNAS_FUNC.filter(c => colFunc[c.ref]);
      const linhas: (string | number)[][] = [
        ["PREFEITURA DO MUNICÍPIO DE CAMPOS DOS GOYTACAZES"],
        ["SECRETARIA MUNICIPAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA"],
        ["E. M. JOSÉ GIRÓ FAÍSCA"],
        [`LISTAGEM DE FUNCIONÁRIOS     EMISSÃO: ${hoje}     ${funcionarios.length} registro(s)`],
        [],
        ["Nº", "Nome do Funcionário", ...cols.map(c => c.label)],
        ...(funcionarios as any[]).map((f, i) => [
          i + 1,
          f.nomeCompleto || "",
          ...cols.map(c => c.ref === "_assinatura" ? "_________________________" : (f[c.ref] || "")),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(linhas);
      ws["!cols"] = [{ wch: 6 }, { wch: 36 }, ...cols.map(c => ({ wch: Math.max(c.label.length + 4, 14) }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Funcionários");
      const dataStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
      XLSX.writeFile(wb, `Listagem_Funcionarios_${dataStr}.xlsx`);
    } finally {
      setExportandoFunc(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-8">
        <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
          Listagens Flexíveis
        </h1>

        <div className="bg-[#1e293b] p-6 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-6">

          {/* ── Seletor de turma + botão gerar ── */}
          <div className="flex gap-4">
            <select
              className="flex-1 px-4 py-3 rounded-xl bg-[#0f172a] text-white border border-[#334155] text-base focus:border-blue-500 focus:outline-none"
              value={turmaSelecionada}
              onChange={(e) => setTurmaSelecionada(e.target.value)}
              disabled={turmasLoading}
            >
              <option value="">
                {turmasLoading ? "Carregando turmas..." : "Selecione a Turma..."}
              </option>
              <option value="__todas__" className="font-bold">
                📋 Todas as Turmas (listagem completa)
              </option>
              <option value="__transferidos__" className="font-bold">
                ⇆ Alunos Transferidos (todas as turmas)
              </option>
              {turmas?.map((t) => (
                <option key={t.id} value={t.nomeTurma}>
                  TURMA: {t.nomeTurma}
                </option>
              ))}
            </select>

            <Button
              onClick={gerarListagem}
              disabled={gerando || baixando || exportando || !turmaSelecionada}
              className="px-6 bg-blue-500 hover:bg-blue-400 text-white font-bold uppercase tracking-wider text-base rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02]"
            >
              {gerando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Gerar
                </span>
              )}
            </Button>

            <Button
              onClick={baixarPdf}
              disabled={gerando || baixando || exportando || !turmaSelecionada}
              className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-base rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              {baixando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  PDF
                </span>
              )}
            </Button>

            <Button
              onClick={baixarExcel}
              disabled={gerando || baixando || exportando || !turmaSelecionada}
              className="px-6 bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider text-base rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
            >
              {exportando ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Excel
                </span>
              )}
            </Button>

            
            {isMaster && (
              <Button
                onClick={imprimirListaNaRicoh}
                disabled={imprimindoRicoh || !turmaSelecionada}
                className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-wider text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02] border-2 border-primary/20"
              >
                {imprimindoRicoh ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5 mr-2" />}
                RICOH
              </Button>
            )}
          </div>

          {/* ── Orientação ── */}
          <div className="bg-white/[0.03] border border-white/[0.07] p-4 rounded-xl">
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Orientação da Folha
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOrientacao("retrato")}
                className={`${btnOrientacaoBase} ${orientacao === "retrato" ? btnAtivo : btnInativo}`}
              >
                <Rows3 className="h-4 w-4" />
                Retrato (Portrait)
              </button>
              <button
                onClick={() => setOrientacao("paisagem")}
                className={`${btnOrientacaoBase} ${orientacao === "paisagem" ? btnAtivo : btnInativo}`}
              >
                <LayoutList className="h-4 w-4" />
                Paisagem (Landscape)
              </button>
            </div>
            <p className="text-[0.7rem] text-white/30 mt-2">
              {orientacao === "retrato"
                ? "Folha A4 na vertical — ideal para listas com poucas colunas"
                : "Folha A4 na horizontal — ideal para listas com muitas colunas"}
            </p>
          </div>

          {/* ── Configurações do cabeçalho ── */}
          <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl">
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-blue-400 mb-3 pb-2 border-b border-blue-500/20">
              ⚙️ Configurações do Cabeçalho
            </p>
            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-2.5 cursor-pointer text-[0.85rem] text-slate-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={showProfessor}
                  onChange={(e) => setShowProfessor(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                Incluir Nome do Professor
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-[0.85rem] text-slate-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={showTurma}
                  onChange={(e) => setShowTurma(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                Incluir Nome/Código da Turma
              </label>
            </div>
          </div>

          {/* ── Colunas da tabela ── */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-500/20">
              <p className="text-[0.75rem] font-bold uppercase tracking-widest text-blue-400">
                📋 Colunas da Tabela
                {qtdMarcadas > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[0.7rem] font-black">
                    {qtdMarcadas} selecionada{qtdMarcadas !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
              {qtdMarcadas > 0 && (
                <button
                  onClick={desmarcarTodas}
                  className="text-[0.7rem] text-white/30 hover:text-red-400 transition-colors font-medium"
                >
                  Desmarcar todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-4 bg-black/30 rounded-xl">
              {COLUNAS_DISPONIVEIS.map((col) => (
                <label
                  key={col.ref}
                  className={`flex items-center gap-2.5 cursor-pointer text-[0.85rem] px-2.5 py-2 rounded-lg transition-all ${
                    colunasMarcadas[col.ref]
                      ? "bg-blue-500/10 border border-blue-500/30 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!colunasMarcadas[col.ref]}
                    onChange={() => toggleColuna(col.ref)}
                    className="w-4 h-4 accent-blue-500 shrink-0"
                  />
                  {col.label}
                </label>
              ))}
            </div>
            {qtdMarcadas === 0 && (
              <p className="text-center text-[0.75rem] text-white/25 mt-3">
                Nenhuma coluna selecionada — a listagem terá apenas Nº e Nome do Aluno
              </p>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            BALÃO DE PROFESSORES
        ══════════════════════════════════════════════════════════ */}
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-violet-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-6">

          {/* título */}
          <div className="flex items-center gap-3 pb-3 border-b border-violet-500/20">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
              <UserCircle className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white" style={{ letterSpacing: "-0.5px" }}>
                Listagem de Professores
              </h2>
              <p className="text-white/40 text-xs mt-0.5">
                {professores.length > 0 ? `${professores.length} professor${professores.length !== 1 ? "es" : ""} cadastrado${professores.length !== 1 ? "s" : ""}` : "Carregando…"}
              </p>
            </div>
          </div>

          {/* botões gerar/pdf/excel */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={gerarHtmlProfessores}
              disabled={gerandoProf || baixandoProf || exportandoProf || professores.length === 0}
              className="px-6 bg-violet-600 hover:bg-violet-500 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
            >
              {gerandoProf ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><UserCircle className="h-4 w-4" />Gerar</span>}
            </Button>
            <Button
              onClick={baixarPdfProfessores}
              disabled={gerandoProf || baixandoProf || exportandoProf || professores.length === 0}
              className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              {baixandoProf ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><Download className="h-4 w-4" />PDF</span>}
            </Button>
            <Button
              onClick={baixarExcelProfessores}
              disabled={gerandoProf || baixandoProf || exportandoProf || professores.length === 0}
              className="px-6 bg-violet-700 hover:bg-violet-600 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02]"
            >
              {exportandoProf ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Excel</span>}
            </Button>
            <Button
              onClick={baixarDocProfessores}
              disabled={gerandoProf || baixandoProf || exportandoProf || professores.length === 0}
              className="px-6 bg-blue-700 hover:bg-blue-600 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />DOC</span>
            </Button>

            {isMaster && (
              <Button
                onClick={imprimirProfNaRicoh}
                disabled={imprimindoRicoh || professores.length === 0}
                className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-wider text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02] border-2 border-primary/20"
              >
                {imprimindoRicoh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                RICOH
              </Button>
            )}
          </div>

          {/* orientação */}
          <div className="bg-white/[0.03] border border-white/[0.07] p-4 rounded-xl">
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-slate-400 mb-3">Orientação da Folha</p>
            <div className="flex gap-3">
              <button onClick={() => setOrientProf("retrato")}
                className={`${btnOrientacaoBase} ${orientProf === "retrato" ? "bg-violet-500/20 border-violet-500/50 text-violet-300" : btnInativo}`}>
                <Rows3 className="h-4 w-4" />Retrato
              </button>
              <button onClick={() => setOrientProf("paisagem")}
                className={`${btnOrientacaoBase} ${orientProf === "paisagem" ? "bg-violet-500/20 border-violet-500/50 text-violet-300" : btnInativo}`}>
                <LayoutList className="h-4 w-4" />Paisagem
              </button>
            </div>
          </div>

          {/* colunas */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-violet-500/20">
              <p className="text-[0.75rem] font-bold uppercase tracking-widest text-violet-400">
                📋 Colunas da Tabela
                {qtdProf > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[0.7rem] font-black">
                    {qtdProf} selecionada{qtdProf !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
              {qtdProf > 0 && (
                <button onClick={() => setColProf(Object.fromEntries(COLUNAS_PROF.map(c => [c.ref, false])))}
                  className="text-[0.7rem] text-white/30 hover:text-red-400 transition-colors font-medium">
                  Desmarcar todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-4 bg-black/30 rounded-xl">
              {COLUNAS_PROF.map(col => (
                <label key={col.ref} className={`flex items-center gap-2.5 cursor-pointer text-[0.85rem] px-2.5 py-2 rounded-lg transition-all ${
                  colProf[col.ref]
                    ? "bg-violet-500/10 border border-violet-500/30 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"}`}>
                  <input type="checkbox" checked={!!colProf[col.ref]} onChange={() => toggleColProf(col.ref)} className="w-4 h-4 accent-violet-500 shrink-0" />
                  {col.label}
                </label>
              ))}
            </div>
            {qtdProf === 0 && <p className="text-center text-[0.75rem] text-white/25 mt-3">Nenhuma coluna selecionada — a listagem terá apenas Nº e Nome do Professor</p>}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            BALÃO DE FUNCIONÁRIOS
        ══════════════════════════════════════════════════════════ */}
        <div className="bg-[#1e293b] p-6 rounded-2xl border border-emerald-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)] space-y-6">

          {/* título */}
          <div className="flex items-center gap-3 pb-3 border-b border-emerald-500/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white" style={{ letterSpacing: "-0.5px" }}>
                Listagem de Funcionários
              </h2>
              <p className="text-white/40 text-xs mt-0.5">
                {funcionarios.length > 0 ? `${funcionarios.length} funcionário${funcionarios.length !== 1 ? "s" : ""} cadastrado${funcionarios.length !== 1 ? "s" : ""}` : "Carregando…"}
              </p>
            </div>
          </div>

          {/* botões gerar/pdf/excel */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={gerarHtmlFuncionarios}
              disabled={gerandoFunc || baixandoFunc || exportandoFunc || funcionarios.length === 0}
              className="px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              {gerandoFunc ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><Users className="h-4 w-4" />Gerar</span>}
            </Button>
            <Button
              onClick={baixarPdfFuncionarios}
              disabled={gerandoFunc || baixandoFunc || exportandoFunc || funcionarios.length === 0}
              className="px-6 bg-emerald-700 hover:bg-emerald-600 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              {baixandoFunc ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><Download className="h-4 w-4" />PDF</span>}
            </Button>
            <Button
              onClick={baixarExcelFuncionarios}
              disabled={gerandoFunc || baixandoFunc || exportandoFunc || funcionarios.length === 0}
              className="px-6 bg-teal-600 hover:bg-teal-500 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02]"
            >
              {exportandoFunc ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Excel</span>}
            </Button>
            <Button
              onClick={baixarDocFuncionarios}
              disabled={gerandoFunc || baixandoFunc || exportandoFunc || funcionarios.length === 0}
              className="px-6 bg-blue-700 hover:bg-blue-600 text-white font-bold uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />DOC</span>
            </Button>

            {isMaster && (
              <Button
                onClick={imprimirFuncNaRicoh}
                disabled={imprimindoRicoh || funcionarios.length === 0}
                className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-wider text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02] border-2 border-primary/20"
              >
                {imprimindoRicoh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                RICOH
              </Button>
            )}
          </div>

          {/* orientação */}
          <div className="bg-white/[0.03] border border-white/[0.07] p-4 rounded-xl">
            <p className="text-[0.75rem] font-bold uppercase tracking-widest text-slate-400 mb-3">Orientação da Folha</p>
            <div className="flex gap-3">
              <button onClick={() => setOrientFunc("retrato")}
                className={`${btnOrientacaoBase} ${orientFunc === "retrato" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : btnInativo}`}>
                <Rows3 className="h-4 w-4" />Retrato
              </button>
              <button onClick={() => setOrientFunc("paisagem")}
                className={`${btnOrientacaoBase} ${orientFunc === "paisagem" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : btnInativo}`}>
                <LayoutList className="h-4 w-4" />Paisagem
              </button>
            </div>
          </div>

          {/* colunas */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-500/20">
              <p className="text-[0.75rem] font-bold uppercase tracking-widest text-emerald-400">
                📋 Colunas da Tabela
                {qtdFunc > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[0.7rem] font-black">
                    {qtdFunc} selecionada{qtdFunc !== 1 ? "s" : ""}
                  </span>
                )}
              </p>
              {qtdFunc > 0 && (
                <button onClick={() => setColFunc(Object.fromEntries(COLUNAS_FUNC.map(c => [c.ref, false])))}
                  className="text-[0.7rem] text-white/30 hover:text-red-400 transition-colors font-medium">
                  Desmarcar todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-4 bg-black/30 rounded-xl">
              {COLUNAS_FUNC.map(col => (
                <label key={col.ref} className={`flex items-center gap-2.5 cursor-pointer text-[0.85rem] px-2.5 py-2 rounded-lg transition-all ${
                  colFunc[col.ref]
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"}`}>
                  <input type="checkbox" checked={!!colFunc[col.ref]} onChange={() => toggleColFunc(col.ref)} className="w-4 h-4 accent-emerald-500 shrink-0" />
                  {col.label}
                </label>
              ))}
            </div>
            {qtdFunc === 0 && <p className="text-center text-[0.75rem] text-white/25 mt-3">Nenhuma coluna selecionada — a listagem terá apenas Nº e Nome do Funcionário</p>}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

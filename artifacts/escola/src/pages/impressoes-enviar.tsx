// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Printer,
  Upload,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  School,
  Zap,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API = (path: string) => `${BASE}api/${path}`;

type StatusAgente = {
  online: boolean;
  lastHeartbeat?: string | null;
  secondsAgo?: number;
  ricohOnline: boolean;
  epsonOnline: boolean;
  ricohStatus: "online" | "descanso" | "offline";
  epsonStatus: "online" | "descanso" | "offline";
  ricohIp?: string;
  epsonIp?: string;
  ricohPingMs?: number | null;
  epsonPingMs?: number | null;
};

type PedidoStatus = {
  id: number;
  professorSolicitante: string;
  nomeArquivo: string | null;
  quantidadeCopias: number;
  duplex: boolean | null;
  colorida: boolean | null;
  impressoraNome?: string | null;
  status: string;
  progresso: number | null;
  mensagemStatus: string | null;
  dataParaUso?: string | null;
  horarioImpressao?: string | null;
  imprimiuEm?: string | null;
};

function detectarTipoLink(raw: string): string | null {
  const u = (raw || "").trim().toLowerCase();
  if (!u) return null;
  if (u.includes("docs.google.com/document/")) return "Google Docs (convertido automaticamente em PDF)";
  if (u.includes("docs.google.com/spreadsheets/")) return "Google Planilhas (convertido automaticamente em PDF)";
  if (u.includes("docs.google.com/presentation/")) return "Google Apresentações (convertido automaticamente em PDF)";
  if (u.includes("drive.google.com")) return "Google Drive (download direto automático)";
  if (u.includes("dropbox.com")) return "Dropbox (download direto automático)";
  if (u.endsWith(".pdf")) return "Documento PDF direto";
  if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(u)) return "Imagem direta";
  if (u.startsWith("http://") || u.startsWith("https://")) return "Link web externo";
  return null;
}

export default function ImpressoesEnviarPage() {
  const { data: me } = useGetMe({ query: { retry: false } } as any);

  const [modo, setModo] = useState<"arquivo" | "link">("arquivo");
  const [nome, setNome] = useState("");
  const [copias, setCopias] = useState(1);
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [obs, setObs] = useState("");
  const [duplex, setDuplex] = useState(false);
  const [colorida, setColorida] = useState(false);
  const [impressoraManual, setImpressoraManual] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [pedidoCriado, setPedidoCriado] = useState<PedidoStatus | null>(null);
  const [erro, setErro] = useState("");
  const [imprimirAgora, setImprimirAgora] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const [statusAgente, setStatusAgente] = useState<StatusAgente>({
    online: false,
    ricohOnline: false,
    epsonOnline: false,
    ricohStatus: "offline",
    epsonStatus: "offline",
    ricohPingMs: null,
    epsonPingMs: null,
  });
  const [verificandoStatus, setVerificandoStatus] = useState(false);

  const buscarStatusImpressoras = useCallback(async (manual = false) => {
    if (manual) setVerificandoStatus(true);
    try {
      const res = await fetch(API("impressoes/status-agente"), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const d = await res.json();
        setStatusAgente({
          online: !!d.online,
          lastHeartbeat: d.lastHeartbeat,
          secondsAgo: d.secondsAgo,
          ricohOnline: !!d.ricohOnline || d.ricohStatus === "online" || d.ricohStatus === "descanso",
          epsonOnline: !!d.epsonOnline || d.epsonStatus === "online" || d.epsonStatus === "descanso",
          ricohStatus: d.ricohStatus || (d.ricohOnline ? "online" : "offline"),
          epsonStatus: d.epsonStatus || (d.epsonOnline ? "online" : "offline"),
          ricohIp: d.ricohIp,
          epsonIp: d.epsonIp,
          ricohPingMs: d.ricohPingMs ?? null,
          epsonPingMs: d.epsonPingMs ?? null,
        });
      }
    } catch {
      // ignora falha de rede momentânea
    } finally {
      if (manual) setVerificandoStatus(false);
    }
  }, []);

  useEffect(() => {
    buscarStatusImpressoras();
    const timer = setInterval(() => buscarStatusImpressoras(), 2500);
    return () => clearInterval(timer);
  }, [buscarStatusImpressoras]);

  // Acompanha status em tempo real do pedido enviado
  useEffect(() => {
    if (!sucesso || !pedidoCriado?.id) return;
    let ativo = true;
    const pollPedido = async () => {
      try {
        const res = await fetch(API(`impressoes/pedido/${pedidoCriado.id}`), { cache: "no-store" });
        if (res.ok && ativo) {
          const d = await res.json();
          setPedidoCriado(d);
        }
      } catch {}
    };
    pollPedido();
    const t = setInterval(pollPedido, 2000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [sucesso, pedidoCriado?.id]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setArquivo(f);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const nomeFinal = nome.trim() || me?.nomeCompleto || "";
    if (!nomeFinal) {
      setErro("Por favor, informe seu nome completo.");
      return;
    }
    if (modo === "arquivo" && !arquivo) {
      setErro("Selecione um arquivo (PDF ou imagem) para enviar.");
      return;
    }
    if (modo === "link" && !link.trim()) {
      setErro("Cole o link do arquivo (Google Drive, Docs, Dropbox ou link direto).");
      return;
    }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("professorSolicitante", nomeFinal);
      form.append("quantidadeCopias", String(Math.max(1, copias)));
      form.append("duplex", String(duplex));
      form.append("colorida", String(colorida));
      form.append("impressoraNome", impressoraManual || (colorida ? "EPSON" : "RICOH"));

      if (!imprimirAgora && data) form.append("dataParaUso", data);
      if (!imprimirAgora && horario) form.append("horarioImpressao", horario);
      if (obs.trim()) form.append("observacoes", obs.trim());
      if (modo === "arquivo" && arquivo) form.append("arquivo", arquivo);
      if (modo === "link") form.append("linkArquivo", link.trim());

      const res = await fetch(API("impressoes"), { method: "POST", body: form });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Erro ao enviar pedido para o servidor.");
      }

      setPedidoCriado(payload);
      setSucesso(true);
    } catch (err: any) {
      setErro(err?.message || "Ocorreu um erro ao enviar. Verifique o arquivo/link e tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const ricohLigada = statusAgente.online && statusAgente.ricohStatus !== "offline";
  const epsonLigada = statusAgente.online && statusAgente.epsonStatus !== "offline";
  const impressoraSelecionadaLigada = colorida ? epsonLigada : ricohLigada;
  const nomeImpressoraSelecionada = colorida ? "Epson L3250 (Colorida)" : "Ricoh SP 3710SF (P&B)";
  const tipoLinkDetectado = modo === "link" ? detectarTipoLink(link) : null;

  if (sucesso) {
    const st = pedidoCriado?.status || "Pendente";
    const prog =
      st === "Impresso"
        ? 100
        : st === "Imprimindo"
        ? Math.max(25, pedidoCriado?.progresso || 35)
        : Math.max(10, pedidoCriado?.progresso || 10);

    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 text-center space-y-5 shadow-2xl">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 transition-all ${
              st === "Impresso"
                ? "bg-emerald-500/20 border-emerald-500/40"
                : st === "Imprimindo"
                ? "bg-sky-500/20 border-sky-500/40"
                : "bg-amber-500/20 border-amber-500/40"
            }`}
          >
            {st === "Impresso" ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            ) : st === "Imprimindo" ? (
              <Printer className="h-10 w-10 text-sky-400 animate-bounce" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">
              {st === "Impresso"
                ? "Impressão Concluída!"
                : st === "Imprimindo"
                ? "Imprimindo seu arquivo..."
                : "Pedido Recebido na Fila!"}
            </h2>
            <p className="text-sm text-white/60">
              {pedidoCriado?.nomeArquivo || "Documento enviado"} ·{" "}
              <strong className="text-white/80">{pedidoCriado?.quantidadeCopias || copias}</strong>{" "}
              cópia{(pedidoCriado?.quantidadeCopias || copias) > 1 ? "s" : ""}
            </p>
          </div>

          {/* Barra de progresso em tempo real */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-4 space-y-2.5 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white/80 flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    st === "Impresso"
                      ? "bg-emerald-400"
                      : st === "Imprimindo"
                      ? "bg-sky-400 animate-ping"
                      : "bg-amber-400 animate-pulse"
                  }`}
                />
                {pedidoCriado?.mensagemStatus ||
                  (st === "Impresso"
                    ? "Impresso com sucesso!"
                    : st === "Imprimindo"
                    ? "Enviando para a impressora..."
                    : impressoraSelecionadaLigada
                    ? "Na fila — robô iniciando impressão..."
                    : `Na fila — aguardando ${nomeImpressoraSelecionada} ser ligada`)}
              </span>
              <span className="font-mono text-white/50">{prog}%</span>
            </div>

            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div
                style={{ width: `${prog}%` }}
                className={`h-full transition-all duration-500 ${
                  st === "Impresso"
                    ? "bg-emerald-500"
                    : st === "Imprimindo"
                    ? "bg-sky-500"
                    : "bg-amber-500"
                }`}
              />
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-white/40">
              <span>Impressora: {nomeImpressoraSelecionada}</span>
              <span
                className={`font-semibold ${
                  impressoraSelecionadaLigada ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {impressoraSelecionadaLigada ? "● Ligada (Online)" : "● Desligada (Offline)"}
              </span>
            </div>
          </div>

          {!impressoraSelecionadaLigada && st !== "Impresso" && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-200/90 text-left flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                A impressora <strong>{nomeImpressoraSelecionada}</strong> consta como{" "}
                <strong>Desligada (Offline)</strong> no momento. Seu arquivo já está salvo e será
                impresso automaticamente assim que ela for ligada!
              </span>
            </div>
          )}

          <Button
            onClick={() => {
              setSucesso(false);
              setPedidoCriado(null);
              setCopias(1);
              setData("");
              setHorario("");
              setObs("");
              setArquivo(null);
              setLink("");
            }}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white h-10 text-sm font-semibold"
          >
            Enviar outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-5">
        {/* Cabeçalho */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
            <Printer className="h-7 w-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Pedido de Impressão</h1>
          <div className="flex items-center justify-center gap-1.5 text-white/40 text-sm">
            <School className="h-4 w-4" />
            E.M. José Giró Faísca
          </div>
        </div>

        {/* Painel Ao Vivo: Status das Impressoras (Ping em Tempo Real) */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  statusAgente.online
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs font-semibold text-white/80">
                Status das Impressoras na Escola
              </span>
            </div>
            <button
              type="button"
              onClick={() => buscarStatusImpressoras(true)}
              className="flex items-center gap-1 text-[11px] text-sky-400/80 hover:text-sky-300 transition-colors"
              title="Atualizar status agora"
            >
              <RefreshCw className={`h-3 w-3 ${verificandoStatus ? "animate-spin" : ""}`} />
              <span>{statusAgente.online ? "Tempo real (2s)" : "Robô Offline"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Card Ricoh */}
            <div
              className={`rounded-xl border px-3 py-2 flex flex-col justify-between transition-all ${
                ricohLigada
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/25"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white truncate">Ricoh SP 3710SF</span>
                {ricohLigada ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    ricohLigada ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      ricohLigada ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  {ricohLigada ? "Ligada (Online)" : "Desligada (Offline)"}
                </span>
                {ricohLigada && statusAgente.ricohPingMs != null && (
                  <span className="text-[10px] font-mono text-emerald-300/70">
                    {statusAgente.ricohPingMs}ms
                  </span>
                )}
              </div>
            </div>

            {/* Card Epson */}
            <div
              className={`rounded-xl border px-3 py-2 flex flex-col justify-between transition-all ${
                epsonLigada
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/25"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white truncate">Epson L3250</span>
                {epsonLigada ? (
                  <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    epsonLigada ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      epsonLigada ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  {epsonLigada ? "Ligada (Online)" : "Desligada (Offline)"}
                </span>
                {epsonLigada && statusAgente.epsonPingMs != null && (
                  <span className="text-[10px] font-mono text-emerald-300/70">
                    {statusAgente.epsonPingMs}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form
          onSubmit={enviar}
          className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-md p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Seu nome completo *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria da Silva"
              className="bg-black/30 border-white/10 h-10 text-sm text-white placeholder:text-white/20"
            />
          </div>

          {/* Tabs arquivo / link */}
          <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
            {(["arquivo", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  modo === m ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "arquivo" ? (
                  <>
                    <Upload className="inline h-4 w-4 mr-1.5" />
                    Enviar arquivo
                  </>
                ) : (
                  <>
                    <LinkIcon className="inline h-4 w-4 mr-1.5" />
                    Link de arquivo
                  </>
                )}
              </button>
            ))}
          </div>

          {modo === "arquivo" ? (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed cursor-pointer transition-all p-6 text-center select-none ${
                arquivo
                  ? "border-emerald-500/50 bg-emerald-500/8"
                  : "border-white/12 hover:border-white/25 bg-white/3"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                hidden
                accept=".pdf,image/*,.html,.htm"
                onChange={(e) => {
                  if (e.target.files?.[0]) setArquivo(e.target.files[0]);
                }}
              />
              {arquivo ? (
                <div className="space-y-1.5">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto" />
                  <p className="text-sm text-emerald-300 font-medium break-all">{arquivo.name}</p>
                  <p className="text-xs text-white/40">
                    {(arquivo.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="h-7 w-7 text-white/25 mx-auto" />
                  <p className="text-sm text-white/50">Toque ou arraste seu arquivo aqui</p>
                  <p className="text-xs text-white/25">PDF ou Imagem (JPG, PNG) · máx 25 MB</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Link do arquivo para impressão *</Label>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="bg-black/30 border-white/10 h-10 text-sm text-white placeholder:text-white/20"
              />
              {tipoLinkDetectado ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Detectado: {tipoLinkDetectado}</span>
                </div>
              ) : (
                <p className="text-[11px] text-white/35 leading-relaxed">
                  Aceita links do <strong>Google Drive</strong>, <strong>Google Docs</strong>,{" "}
                  <strong>Planilhas</strong>, <strong>Dropbox</strong> ou links diretos de PDF/imagem.
                </p>
              )}
            </div>
          )}

          {/* Seleção de Impressora com status Ligada/Desligada */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Escolha a Impressora</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setColorida(false);
                  setImpressoraManual("RICOH");
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                  !colorida
                    ? "bg-white/12 border-white/30 text-white shadow-md"
                    : "bg-black/20 border-white/8 text-white/45 hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold">⬛ Padrão (P&B)</span>
                <span className="text-[11px] opacity-75">Ricoh SP 3710SF</span>
                <span
                  className={`mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    ricohLigada
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}
                >
                  {ricohLigada ? "● Ligada" : "● Desligada"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setColorida(true);
                  setImpressoraManual("EPSON");
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                  colorida
                    ? "bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-md"
                    : "bg-black/20 border-white/8 text-white/45 hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold">🎨 Colorida</span>
                <span className="text-[11px] opacity-75">Epson L3250</span>
                <span
                  className={`mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    epsonLigada
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border border-red-500/30"
                  }`}
                >
                  {epsonLigada ? "● Ligada" : "● Desligada"}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Nº de cópias *</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={copias}
              onChange={(e) => setCopias(Number(e.target.value))}
              className="bg-black/30 border-white/10 h-10 text-sm text-white"
            />
          </div>

          {/* Toggle: Imprimir Agora × Agendar */}
          <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
            <button
              type="button"
              onClick={() => setImprimirAgora(true)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                imprimirAgora
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Zap className="h-4 w-4" />
              Imprimir agora!
            </button>
            <button
              type="button"
              onClick={() => setImprimirAgora(false)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                !imprimirAgora ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              <Clock className="h-4 w-4" />
              Agendar horário
            </button>
          </div>

          {!imprimirAgora && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Agendar impressão para</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="bg-black/30 border-white/10 h-10 text-sm text-white"
                />
                <Input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="bg-black/30 border-white/10 h-10 text-sm text-white"
                />
              </div>
            </div>
          )}

          {imprimirAgora && (
            <div
              className={`rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border ${
                impressoraSelecionadaLigada
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300/90"
                  : "bg-amber-500/10 border-amber-500/25 text-amber-200/90"
              }`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <p className="text-xs leading-relaxed">
                {impressoraSelecionadaLigada ? (
                  <>
                    A <strong>{nomeImpressoraSelecionada}</strong> está <strong>Ligada</strong>! Seu
                    arquivo começará a ser impresso em poucos segundos.
                  </>
                ) : (
                  <>
                    A <strong>{nomeImpressoraSelecionada}</strong> está{" "}
                    <strong>Desligada (Offline)</strong> no momento. Seu pedido ficará na fila e
                    imprimirá automaticamente assim que ela for ligada.
                  </>
                )}
              </p>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
              className="w-4 h-4 rounded accent-violet-500"
            />
            <span className="text-sm text-white/70">Imprimir frente e verso</span>
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Observações (opcional)</Label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Ex: Só a primeira página, papel ofício..."
              className="w-full rounded-xl bg-black/30 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-sky-500/40 placeholder:text-white/20"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <Button
            type="submit"
            disabled={enviando}
            className={`w-full text-white h-11 text-sm font-semibold transition-all ${
              imprimirAgora ? "bg-emerald-600 hover:bg-emerald-500" : "bg-sky-600 hover:bg-sky-500"
            }`}
          >
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : imprimirAgora ? (
              <Zap className="h-4 w-4 mr-2" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            {enviando
              ? "Enviando arquivo..."
              : imprimirAgora
              ? "Enviar e Imprimir Agora!"
              : "Agendar pedido de impressão"}
          </Button>
        </form>

        <p className="text-center text-[11px] text-white/25">
          Monitoramento automático de impressoras via Ping ICMP/TCP em tempo real.
        </p>
      </div>
    </div>
  );
}

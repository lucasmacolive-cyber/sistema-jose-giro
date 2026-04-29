// @ts-nocheck
import { useState, useRef, useCallback } from "react";
import { Printer, Upload, CheckCircle2, Link as LinkIcon, Loader2, School, Zap, Clock, ShieldCheck } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
const API  = (path: string) => `${BASE}api/${path}`;

export default function ImpressoesEnviarPage() {
  const { data: me } = useGetMe({ query: { retry: false } } as any);
  const isMaster = me?.perfil === "Master";
  
  const [modo, setModo]         = useState<"arquivo" | "link">("arquivo");
  const [nome, setNome]         = useState("");
  const [copias, setCopias]     = useState(1);
  const [data, setData]         = useState("");
  const [horario, setHorario]   = useState("");
  const [obs, setObs]           = useState("");
  const [duplex, setDuplex]     = useState(false);
  const [colorida, setColorida] = useState(false);
  const [impressoraManual, setImpressoraManual] = useState<string | null>(null);
  const [link, setLink]         = useState("");
  const [arquivo, setArquivo]   = useState<File | null>(null);
  const [enviando, setEnviando]           = useState(false);
  const [sucesso, setSucesso]             = useState(false);
  const [erro, setErro]                   = useState("");
  const [imprimirAgora, setImprimirAgora] = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setArquivo(f);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) { setErro("Por favor, informe seu nome."); return; }
    if (modo === "arquivo" && !arquivo) { setErro("Selecione um arquivo para enviar."); return; }
    if (modo === "link" && !link.trim()) { setErro("Informe o link do arquivo."); return; }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("professorSolicitante", nome.trim() || me?.nomeCompleto || "Master");
      form.append("quantidadeCopias", String(copias));
      form.append("duplex", String(duplex));
      form.append("colorida", String(colorida));
      if (impressoraManual) form.append("impressoraNome", impressoraManual);
      
      if (!imprimirAgora && data)    form.append("dataParaUso", data);
      if (!imprimirAgora && horario) form.append("horarioImpressao", horario);
      if (obs)     form.append("observacoes", obs.trim());
      if (modo === "arquivo" && arquivo) form.append("arquivo", arquivo);
      if (modo === "link")   form.append("linkArquivo", link.trim());

      const res = await fetch(API("impressoes"), { method: "POST", body: form });
      if (!res.ok) throw new Error("Erro no servidor");
      setSucesso(true);
    } catch {
      setErro("Ocorreu um erro ao enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const enviarComoMaster = async (printer: "RICOH" | "EPSON") => {
    setImpressoraManual(printer);
    setColorida(printer === "EPSON");
    setImprimirAgora(true);
    // O envio será disparado pelo clique no botão que chama esta função e depois o enviar
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Pedido enviado!</h2>
          <p className="text-white/50">
            Seu pedido de impressão foi recebido com sucesso.<br />
            Você será avisado quando estiver pronto.
          </p>
          <button
            onClick={() => { setSucesso(false); setNome(""); setCopias(1); setData(""); setHorario(""); setObs(""); setArquivo(null); setLink(""); }}
            className="text-sm text-sky-400/70 hover:text-sky-300 underline underline-offset-2 transition-colors"
          >
            Enviar outro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">

        {/* Cabeçalho */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto">
            <Printer className="h-7 w-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Pedido de Impressão</h1>
          <div className="flex items-center justify-center gap-1.5 text-white/40 text-sm">
            <School className="h-4 w-4" />
            E.M. José Giró Faísca
          </div>
        </div>

        {/* Formulário */}
        <div className="rounded-2xl border border-white/8 bg-white/4 backdrop-blur-md p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Seu nome completo *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: João da Silva"
              className="bg-black/30 border-white/10 h-10 text-sm text-white placeholder:text-white/20" />
          </div>

          {/* Tabs arquivo / link */}
          <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
            {(["arquivo", "link"] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setModo(m)}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  modo === m ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {m === "arquivo"
                  ? <><Upload className="inline h-4 w-4 mr-1.5" />Enviar arquivo</>
                  : <><LinkIcon className="inline h-4 w-4 mr-1.5" />Link externo</>}
              </button>
            ))}
          </div>

          {modo === "arquivo" ? (
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed cursor-pointer transition-all p-6 text-center select-none
                ${arquivo ? "border-emerald-500/50 bg-emerald-500/8" : "border-white/12 hover:border-white/25 bg-white/3"}`}
            >
              <input ref={inputRef} type="file" hidden accept=".pdf,image/*"
                onChange={e => { if (e.target.files?.[0]) setArquivo(e.target.files[0]); }} />
              {arquivo ? (
                <div className="space-y-1.5">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto" />
                  <p className="text-sm text-emerald-300 font-medium">{arquivo.name}</p>
                  <p className="text-xs text-white/30">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload className="h-7 w-7 text-white/20 mx-auto" />
                  <p className="text-sm text-white/40">Toque ou arraste para selecionar</p>
                  <p className="text-xs text-white/20">PDF ou imagem · máx 20 MB</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Link do arquivo *</Label>
              <Input value={link} onChange={e => setLink(e.target.value)}
                placeholder="https://drive.google.com/file/..."
                className="bg-black/30 border-white/10 h-10 text-sm text-white placeholder:text-white/20" />
              <p className="text-[11px] text-white/30">Google Drive, Dropbox, etc.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Nº de cópias *</Label>
            <Input type="number" min={1} max={200} value={copias} onChange={e => setCopias(Number(e.target.value))}
              className="bg-black/30 border-white/10 h-10 text-sm text-white" />
          </div>

          {/* Toggle: Imprimir Agora × Agendar */}
          <div className="flex rounded-xl bg-black/20 border border-white/8 p-1 gap-1">
            <button type="button"
              onClick={() => setImprimirAgora(false)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                !imprimirAgora ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
            >
              <Clock className="h-4 w-4" />
              Agendar horário
            </button>
            <button type="button"
              onClick={() => setImprimirAgora(true)}
              className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                imprimirAgora
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                  : "text-white/40 hover:text-white/70"}`}
            >
              <Zap className="h-4 w-4" />
              Imprimir agora!
            </button>
          </div>

          {/* Campos de data/hora — só aparecem se NÃO for "Imprimir Agora" */}
          {!imprimirAgora && (
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Agendar impressão para</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={data} onChange={e => setData(e.target.value)}
                  className="bg-black/30 border-white/10 h-10 text-sm text-white" />
                <Input type="time" value={horario} onChange={e => setHorario(e.target.value)}
                  className="bg-black/30 border-white/10 h-10 text-sm text-white" />
              </div>
              <p className="text-[11px] text-white/30">
                {data || horario
                  ? "A impressão será enviada automaticamente na data e hora informadas."
                  : "Deixe em branco para imprimir assim que o arquivo chegar ao computador da escola."}
              </p>
            </div>
          )}

          {/* Aviso quando "Imprimir Agora" está ativo */}
          {imprimirAgora && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 flex items-center gap-3">
              <Zap className="h-5 w-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300/80">
                Seu arquivo será impresso na <strong>{colorida ? "Epson L3250" : "Ricoh SP 3710sf"}</strong> em até 30 segundos após o envio.
              </p>
            </div>
          )}

          {/* Seleção de Impressora */}
          <div className="space-y-1.5 mt-2">
            <Label className="text-xs text-white/50">Tipo de Impressão</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setColorida(false)}
                className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  !colorida ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/5 text-white/40 hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold mb-0.5">⬛ Padrão (P&B)</span>
                <span className="text-[10px] opacity-70">Ricoh SP 3710SF</span>
              </button>
              <button type="button" onClick={() => setColorida(true)}
                className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  colorida ? "bg-sky-500/20 border-sky-500/40 text-sky-300" : "bg-black/20 border-white/5 text-white/40 hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-semibold mb-0.5">🎨 Colorida</span>
                <span className="text-[10px] opacity-70">Epson L3250</span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={duplex} onChange={e => setDuplex(e.target.checked)}
              className="w-4 h-4 rounded accent-violet-500" />
            <span className="text-sm text-white/70">Imprimir frente e verso</span>
          </label>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Observações</Label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex: Só a primeira página, papel ofício..."
              className="w-full rounded-xl bg-black/30 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-sky-500/40 placeholder:text-white/20"
            />
          </div>

          {/* Opções Master */}
          {isMaster && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                <ShieldCheck className="h-4 w-4" />
                Controle Master de Impressão
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={(e) => { 
                    setImpressoraManual("RICOH"); 
                    setColorida(false); 
                    setImprimirAgora(true);
                    setTimeout(() => enviar(e), 50); 
                  }}
                  disabled={enviando}
                  className="bg-slate-700 hover:bg-slate-600 text-white h-14 flex flex-col gap-0.5"
                >
                  <span className="text-xs font-bold">IMPRIMIR NA</span>
                  <span className="text-sm font-black">RICOH (P&B)</span>
                </Button>
                <Button 
                  onClick={(e) => { 
                    setImpressoraManual("EPSON"); 
                    setColorida(true); 
                    setImprimirAgora(true);
                    setTimeout(() => enviar(e), 50); 
                  }}
                  disabled={enviando}
                  className="bg-sky-700 hover:bg-sky-600 text-white h-14 flex flex-col gap-0.5"
                >
                  <span className="text-xs font-bold">IMPRIMIR NA</span>
                  <span className="text-sm font-black">EPSON (COR)</span>
                </Button>
              </div>
              <p className="text-[10px] text-white/30 text-center italic">
                Atenção: Ao clicar, o arquivo será enviado diretamente para a impressora escolhida.
              </p>
            </div>
          )}

          {erro && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>
          )}

          {/* Botão Padrão para Professores (Escondido para Master se ele preferir os botões acima) */}
          {!isMaster && (
            <Button onClick={enviar} disabled={enviando}
              className={`w-full text-white h-11 text-sm font-semibold transition-all ${
                imprimirAgora ? "bg-emerald-600 hover:bg-emerald-500" : "bg-sky-600 hover:bg-sky-500"
              }`}
            >
              {enviando
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : imprimirAgora
                  ? <Zap className="h-4 w-4 mr-2" />
                  : <Printer className="h-4 w-4 mr-2" />
              }
              {imprimirAgora ? "Enviar e Imprimir Agora!" : "Enviar pedido de impressão"}
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-white/20">
          O pedido será recebido pela secretaria e impresso na impressora da escola.
        </p>
      </div>
    </div>
  );
}

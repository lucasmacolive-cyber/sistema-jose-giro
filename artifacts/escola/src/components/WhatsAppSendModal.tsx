import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useListarProfessores, useListarFuncionarios } from "@workspace/api-client-react";

interface WhatsAppSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (numero: string, mensagem: string) => Promise<void>;
  title?: string;
}

export function WhatsAppSendModal({ open, onOpenChange, onSend, title = "Enviar via WhatsApp" }: WhatsAppSendModalProps) {
  const [destinoTipo, setDestinoTipo] = useState<"grupo" | "professor" | "funcionario" | "outro">("outro");
  const [numeroOutro, setNumeroOutro] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [escolaGrupoJid, setEscolaGrupoJid] = useState("");
  const [mensagem, setMensagem] = useState("Segue o documento solicitado.");
  const [enviando, setEnviando] = useState(false);

  const { data: professores } = useListarProfessores();
  const { data: funcionarios } = useListarFuncionarios();

  useEffect(() => {
    if (open) {
      const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";
      fetch(`${BASE}api/escola/contatos`)
        .then(res => res.json())
        .then(data => {
          if (data && data.escola_whatsapp_grupo) {
            setEscolaGrupoJid(data.escola_whatsapp_grupo);
          } else {
            setEscolaGrupoJid("");
          }
        })
        .catch(err => console.error("Erro ao carregar contatos da escola:", err));
    }
  }, [open]);

  // Máscara simples para celular (DD) 9XXXX-XXXX
  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.substring(0, 11);
    
    if (v.length > 2) {
      v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    }
    if (v.length > 10) {
      v = `${v.substring(0, 10)}-${v.substring(10)}`;
    }
    setNumeroOutro(v);
  };

  const getNumeroFinal = () => {
    if (destinoTipo === "grupo") {
      return escolaGrupoJid || "grupo_da_escola";
    }
    if (destinoTipo === "professor" && professorId) {
      const prof = professores?.find(p => p.id.toString() === professorId);
      return prof?.telefone || "";
    }
    if (destinoTipo === "funcionario" && funcionarioId) {
      const func = funcionarios?.find(f => f.id.toString() === funcionarioId);
      return func?.telefoneContato || "";
    }
    return numeroOutro;
  };

  const handleSend = async () => {
    const rawNumber = getNumeroFinal();
    if (destinoTipo === "grupo" && !rawNumber) {
      toast({ 
        title: "Grupo da Escola Não Configurado", 
        description: "Por favor, configure o Grupo da Escola na aba 'Contatos e E-mail' em Ajustes.", 
        variant: "destructive" 
      });
      return;
    }

    const limpo = (rawNumber.includes("@g.us") || rawNumber === "grupo_da_escola") ? rawNumber : rawNumber.replace(/\D/g, "");
    if (!(rawNumber.includes("@g.us") || rawNumber === "grupo_da_escola") && limpo.length < 10) {
      toast({ title: "Número Inválido", description: "O contato selecionado não possui um número de celular válido cadastrado.", variant: "destructive" });
      return;
    }

    setEnviando(true);
    try {
      await onSend(limpo, mensagem);
      toast({ title: "Enviado para a Fila!", description: "O documento foi encaminhado para o Robô da Escola enviar pelo WhatsApp." });
      setNumeroOutro("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message || "Não foi possível enviar o documento.", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !enviando && onOpenChange(v)}>
      <DialogContent className="max-w-md bg-[#0f172a] border-white/10 text-white rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Escolha o destinatário que receberá o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDestinoTipo("grupo")}
              className={`p-2 text-sm border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "grupo" ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Grupo da Escola
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("professor")}
              className={`p-2 text-sm border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "professor" ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Professor(a)
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("funcionario")}
              className={`p-2 text-sm border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "funcionario" ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Funcionário(a)
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("outro")}
              className={`p-2 text-sm border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "outro" ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Outro Número
            </button>
          </div>

          <div className="space-y-4">
            {destinoTipo === "professor" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">Selecione o Professor</label>
                <select
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {professores?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.telefone ? `(${p.telefone})` : "(Sem telefone)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destinoTipo === "funcionario" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">Selecione o Funcionário</label>
                <select
                  value={funcionarioId}
                  onChange={(e) => setFuncionarioId(e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {funcionarios?.map(func => (
                    <option key={func.id} value={func.id}>
                      {func.nomeCompleto} {func.telefoneContato ? `(${func.telefoneContato})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destinoTipo === "outro" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">Número (WhatsApp)</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={numeroOutro}
                  onChange={handleNumeroChange}
                  disabled={enviando}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-400">Mensagem (Opcional)</label>
              <input
                type="text"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={enviando}
                className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-emerald-600/20"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? "Aguardando Robô..." : "Adicionar na Fila de Envio"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

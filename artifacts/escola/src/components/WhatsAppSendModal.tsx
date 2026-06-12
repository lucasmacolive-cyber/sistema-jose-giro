import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WhatsAppSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (numero: string, mensagem: string) => Promise<void>;
  title?: string;
}

export function WhatsAppSendModal({ open, onOpenChange, onSend, title = "Enviar via WhatsApp" }: WhatsAppSendModalProps) {
  const [numero, setNumero] = useState("");
  const [mensagem, setMensagem] = useState("Segue o documento solicitado.");
  const [enviando, setEnviando] = useState(false);

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
    setNumero(v);
  };

  const handleSend = async () => {
    const limpo = numero.replace(/\D/g, "");
    if (limpo.length < 10) {
      toast({ title: "Número Inválido", description: "Digite um número de celular válido com DDD.", variant: "destructive" });
      return;
    }

    setEnviando(true);
    try {
      await onSend(limpo, mensagem);
      toast({ title: "Enviado com sucesso!", description: "O documento foi encaminhado para o WhatsApp." });
      setNumero("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message || "Não foi possível enviar o documento.", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !enviando && onOpenChange(v)}>
      <DialogContent className="max-w-sm bg-[#0f172a] border-white/10 text-white rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Informe o número de destino para receber o PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-400">Número (WhatsApp)</label>
            <input
              type="text"
              placeholder="(11) 99999-9999"
              value={numero}
              onChange={handleNumeroChange}
              disabled={enviando}
              className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

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

          <button
            onClick={handleSend}
            disabled={enviando || numero.replace(/\D/g, "").length < 10}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-emerald-600/20"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? "Processando e Enviando..." : "Enviar PDF"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

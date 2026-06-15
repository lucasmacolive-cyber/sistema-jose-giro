import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useListarProfessores, useListarFuncionarios } from "@workspace/api-client-react";

interface EmailSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (destinatario: string, assunto: string, corpo: string) => Promise<void>;
  title?: string;
  defaultSubject?: string;
}

export function EmailSendModal({
  open,
  onOpenChange,
  onSend,
  title = "Enviar por E-mail",
  defaultSubject = "Documento Escolar - E. M. José Giró Faísca"
}: EmailSendModalProps) {
  const [destinoTipo, setDestinoTipo] = useState<"escola" | "professor" | "funcionario" | "outro">("outro");
  const [emailOutro, setEmailOutro] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [assunto, setAssunto] = useState(defaultSubject);
  const [corpo, setCorpo] = useState("Segue em anexo o documento escolar solicitado.");
  const [enviando, setEnviando] = useState(false);

  const { data: professores } = useListarProfessores();
  const { data: funcionarios } = useListarFuncionarios();

  const getEmailFinal = () => {
    if (destinoTipo === "escola") {
      return "escola"; // O backend resolverá o e-mail de referência
    }
    if (destinoTipo === "professor" && professorId) {
      const prof = professores?.find(p => p.id.toString() === professorId);
      return prof?.email || "";
    }
    if (destinoTipo === "funcionario" && funcionarioId) {
      const func = funcionarios?.find(f => f.id.toString() === funcionarioId);
      return (func as any).email || "";
    }
    return emailOutro;
  };

  const handleSend = async () => {
    const dest = getEmailFinal().trim();
    if (!dest) {
      toast({ title: "Destinatário Inválido", description: "Selecione ou digite um e-mail válido.", variant: "destructive" });
      return;
    }

    if (destinoTipo === "outro" && !dest.includes("@")) {
      toast({ title: "E-mail Inválido", description: "O e-mail digitado parece não ser válido.", variant: "destructive" });
      return;
    }

    setEnviando(true);
    try {
      await onSend(dest, assunto, corpo);
      toast({ title: "E-mail enviado!", description: "O documento foi enviado com sucesso por e-mail." });
      setEmailOutro("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao enviar e-mail", description: err.message || "Não foi possível enviar o e-mail.", variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !enviando && onOpenChange(v)}>
      <DialogContent className="max-w-md bg-[#0f172a] border-white/10 text-white rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-400" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Escolha o destinatário que receberá o PDF por e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDestinoTipo("escola")}
              className={`p-2 text-xs border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "escola" ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              E-mail da Escola
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("professor")}
              className={`p-2 text-xs border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "professor" ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Professor(a)
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("funcionario")}
              className={`p-2 text-xs border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "funcionario" ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Funcionário(a)
            </button>
            <button
              type="button"
              onClick={() => setDestinoTipo("outro")}
              className={`p-2 text-xs border rounded-xl flex items-center justify-center font-bold transition-all ${
                destinoTipo === "outro" ? "bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "border-white/10 text-gray-400 hover:bg-white/5"
              }`}
            >
              Outro E-mail
            </button>
          </div>

          <div className="space-y-4">
            {destinoTipo === "professor" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">Selecione o Professor</label>
                <select
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Selecione...</option>
                  {professores?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.email ? `(${p.email})` : "(Sem e-mail)"}
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
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="">Selecione...</option>
                  {funcionarios?.map(func => (
                    <option key={func.id} value={func.id}>
                      {func.nomeCompleto} {(func as any).email ? `(${(func as any).email})` : "(Sem e-mail)"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destinoTipo === "outro" && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-400">E-mail Destinatário</label>
                <input
                  type="email"
                  placeholder="exemplo@dominio.com"
                  value={emailOutro}
                  onChange={(e) => setEmailOutro(e.target.value)}
                  disabled={enviando}
                  className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-400">Assunto</label>
              <input
                type="text"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                disabled={enviando}
                className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-gray-400">Mensagem (Corpo do E-mail)</label>
              <textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                disabled={enviando}
                rows={3}
                className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-orange-600/20"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? "Enviando e-mail..." : "Enviar por E-mail"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

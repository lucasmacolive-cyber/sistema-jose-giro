import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useListarArquivoMorto,
  useCriarArquivoMortoAluno,
  useObterArquivoMortoAluno,
  useAdicionarDocumentoArquivoMorto,
  useDeletarDocumentoArquivoMorto,
  useDeletarArquivoMortoAluno,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Plus,
  Archive,
  FileText,
  Download,
  Trash2,
  Camera,
  Upload,
  X,
  ChevronRight,
  Printer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import jsPDF from "jspdf";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

async function requestUploadUrl(name: string, size: number, contentType: string) {
  const res = await fetch(`${BASE_URL}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, size, contentType }),
  });
  if (!res.ok) throw new Error("Erro ao solicitar URL de upload");
  return res.json() as Promise<{ uploadURL: string; objectPath: string }>;
}

async function imageToPdfBlob(imageFile: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: img.width > img.height ? "landscape" : "portrait",
          unit: "px",
          format: [img.width, img.height],
        });
        pdf.addImage(img, "JPEG", 0, 0, img.width, img.height);
        resolve(pdf.output("blob"));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

function useUploadArquivo() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function uploadArquivo(file: File): Promise<{ objectPath: string; nomeArquivo: string; tamanhoBytes: number }> {
    setUploading(true);
    setProgress(10);
    try {
      let uploadBlob: Blob = file;
      let fileName = file.name;
      let contentType = file.type;

      // Se for imagem, converter para PDF
      if (file.type.startsWith("image/")) {
        uploadBlob = await imageToPdfBlob(file);
        fileName = file.name.replace(/\.[^.]+$/, "") + ".pdf";
        contentType = "application/pdf";
      }

      setProgress(30);

      const { uploadURL, objectPath } = await requestUploadUrl(
        fileName,
        uploadBlob.size,
        contentType
      );

      setProgress(50);

      await fetch(uploadURL, {
        method: "PUT",
        body: uploadBlob,
        headers: { "Content-Type": contentType },
      });

      setProgress(100);

      return {
        objectPath,
        nomeArquivo: fileName,
        tamanhoBytes: uploadBlob.size,
      };
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }

  return { uploadArquivo, uploading, progress };
}

// ─── Formulário de adicionar aluno ───────────────────────────────────────────
function DialogAdicionarAluno({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const criar = useCriarArquivoMortoAluno();
  const [form, setForm] = useState({
    nomeAluno: "",
    matricula: "",
    anoSaida: "",
    turma: "",
    observacoes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nomeAluno.trim()) return;
    await criar.mutateAsync(
      { data: form },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["/arquivo-morto"] });
          setForm({ nomeAluno: "", matricula: "", anoSaida: "", turma: "", observacoes: "" });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Novo Aluno — Arquivo Morto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="text-white/70 text-xs uppercase tracking-wider">Nome do Aluno *</Label>
            <Input
              value={form.nomeAluno}
              onChange={(e) => setForm((f) => ({ ...f, nomeAluno: e.target.value }))}
              className="mt-1 bg-background/50 border-white/10 text-white"
              placeholder="Nome completo"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider">Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                className="mt-1 bg-background/50 border-white/10 text-white"
                placeholder="Ex: 2024001"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs uppercase tracking-wider">Ano de Saída</Label>
              <Input
                value={form.anoSaida}
                onChange={(e) => setForm((f) => ({ ...f, anoSaida: e.target.value }))}
                className="mt-1 bg-background/50 border-white/10 text-white"
                placeholder="Ex: 2023"
              />
            </div>
          </div>
          <div>
            <Label className="text-white/70 text-xs uppercase tracking-wider">Turma</Label>
            <Input
              value={form.turma}
              onChange={(e) => setForm((f) => ({ ...f, turma: e.target.value }))}
              className="mt-1 bg-background/50 border-white/10 text-white"
              placeholder="Ex: 5AM01"
            />
          </div>
          <div>
            <Label className="text-white/70 text-xs uppercase tracking-wider">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              className="mt-1 bg-background/50 border-white/10 text-white resize-none"
              rows={3}
              placeholder="Observações opcionais..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={criar.isPending}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {criar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de detalhe do aluno ───────────────────────────────────────────────
function PainelAluno({
  alunoId,
  onClose,
}: {
  alunoId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: aluno, isLoading } = useObterArquivoMortoAluno(alunoId);
  const addDoc = useAdicionarDocumentoArquivoMorto();
  const delDoc = useDeletarDocumentoArquivoMorto();
  const delAluno = useDeletarArquivoMortoAluno();
  const { uploadArquivo, uploading, progress } = useUploadArquivo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [deletando, setDeletando] = useState<number | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: [`/arquivo-morto/${alunoId}`] });
    qc.invalidateQueries({ queryKey: ["/arquivo-morto"] });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const { objectPath, nomeArquivo, tamanhoBytes } = await uploadArquivo(file);
    await addDoc.mutateAsync(
      {
        id: alunoId,
        data: { nomeArquivo, objectPath, tamanhoBytes },
      },
      { onSuccess: invalidar }
    );
  };

  const handleDeleteDoc = async (docId: number) => {
    setDeletando(docId);
    await delDoc.mutateAsync(
      { docId },
      { onSuccess: invalidar }
    );
    setDeletando(null);
  };

  const handleDeleteAluno = async () => {
    if (!confirm(`Remover "${aluno?.nomeAluno}" do arquivo morto? Todos os documentos serão apagados.`)) return;
    await delAluno.mutateAsync({ id: alunoId });
    qc.invalidateQueries({ queryKey: ["/arquivo-morto"] });
    onClose();
  };

  const handleDownload = (doc: { objectPath: string; nomeArquivo: string }) => {
    const url = `${BASE_URL}api/storage${doc.objectPath}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nomeArquivo;
    a.target = "_blank";
    a.click();
  };

  const handlePrint = (doc: { objectPath: string }) => {
    const url = `${BASE_URL}api/storage${doc.objectPath}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : aluno ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-white text-xl uppercase">{aluno.nomeAluno}</DialogTitle>
                  <div className="flex gap-3 mt-1.5 text-white/50 text-xs flex-wrap">
                    {aluno.matricula && <span>Matrícula: <span className="text-white/70">{aluno.matricula}</span></span>}
                    {aluno.anoSaida && <span>Saída: <span className="text-white/70">{aluno.anoSaida}</span></span>}
                    {aluno.turma && <span>Turma: <span className="text-white/70">{aluno.turma}</span></span>}
                  </div>
                  {aluno.observacoes && (
                    <p className="text-white/40 text-xs mt-1 italic">{aluno.observacoes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 shrink-0"
                  onClick={handleDeleteAluno}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* Botões de adicionar documento */}
            <div className="mt-4">
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">
                Adicionar Histórico
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 border-white/10 text-white/80 hover:border-primary/50 hover:text-white"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Fotografar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 border-white/10 text-white/80 hover:border-primary/50 hover:text-white"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Arquivo
                </Button>
              </div>

              {/* Input câmera (mobile) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {/* Input upload (pdf ou imagem) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />

              {/* Barra de progresso */}
              {uploading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Enviando...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lista de documentos */}
            <div className="mt-4 space-y-2">
              <p className="text-white/50 text-xs uppercase tracking-wider">
                Documentos ({aluno.documentos?.length ?? 0})
              </p>

              {(aluno.documentos ?? []).length === 0 ? (
                <div className="py-10 text-center text-white/30 border border-white/5 rounded-xl border-dashed">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum documento ainda</p>
                  <p className="text-xs mt-1">Fotografe ou envie um arquivo PDF</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(aluno.documentos ?? []).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 bg-background/30 rounded-xl border border-white/5"
                    >
                      <FileText className="h-5 w-5 text-primary/70 shrink-0" />
                      <span className="flex-1 text-white/80 text-sm truncate">
                        {doc.nomeArquivo}
                      </span>
                      {doc.tamanhoBytes && (
                        <span className="text-white/30 text-xs shrink-0">
                          {(doc.tamanhoBytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/50 hover:text-white"
                          onClick={() => handlePrint(doc)}
                          title="Abrir / Imprimir"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/50 hover:text-white"
                          onClick={() => handleDownload(doc)}
                          title="Baixar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400/60 hover:text-red-400"
                          onClick={() => handleDeleteDoc(doc.id)}
                          disabled={deletando === doc.id}
                          title="Remover"
                        >
                          {deletando === doc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-white/50 text-center py-10">Aluno não encontrado.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ArquivoMortoPage() {
  const { data: lista, isLoading } = useListarArquivoMorto();
  const [search, setSearch] = useState("");
  const [dialogAdd, setDialogAdd] = useState(false);
  const [alunoSelecionado, setAlunoSelecionado] = useState<number | null>(null);

  const filtered = (lista ?? []).filter(
    (a) =>
      (a.nomeAluno ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.matricula ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.turma ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.anoSaida ?? "").includes(search)
  );

  return (
    <AppLayout>
      <div className="space-y-8 pb-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-white" style={{ letterSpacing: "-1px" }}>
              Arquivo Morto
            </h1>
            <p className="text-white/40 text-sm mt-0.5">Históricos de alunos egressos</p>
          </div>
          <Button
            onClick={() => setDialogAdd(true)}
            className="bg-primary hover:bg-primary/90 font-semibold gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar Aluno
          </Button>
        </div>

        {/* Busca */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, matrícula, turma ou ano..."
            className="pl-11 h-12 bg-card/50 border-white/10 focus-visible:ring-primary/30 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((aluno) => {
              const inicial = (aluno.nomeAluno ?? "?")[0].toUpperCase();
              return (
                <div
                  key={aluno.id}
                  onClick={() => setAlunoSelecionado(aluno.id)}
                  className="flex items-center h-[82px] rounded-[50px_15px_15px_50px] p-2.5 cursor-pointer border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 group"
                  style={{
                    background: "linear-gradient(135deg, rgba(60,60,80,0.7), rgba(40,40,60,0.9))",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Avatar */}
                  <div className="w-[62px] h-[62px] rounded-full flex items-center justify-center font-black text-xl mr-4 shrink-0 text-white/80 uppercase bg-white/10">
                    {inicial}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[1rem] text-white leading-tight truncate uppercase">
                      {aluno.nomeAluno}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {aluno.turma && (
                        <span className="text-[0.65rem] bg-white/10 px-2 py-0.5 rounded-md text-white/60 uppercase tracking-wide">
                          {aluno.turma}
                        </span>
                      )}
                      {aluno.anoSaida && (
                        <span className="text-[0.65rem] text-white/40">{aluno.anoSaida}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Archive className="h-3 w-3 text-white/30" />
                      <span className="text-[0.65rem] text-white/30">
                        {aluno.totalDocumentos ?? 0} doc{(aluno.totalDocumentos ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0 mr-1" />
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground bg-card/20 rounded-2xl border border-white/5 border-dashed">
                <Archive className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Nenhum aluno encontrado</p>
                <p className="text-xs mt-1 opacity-60">
                  {search ? "Tente outra busca" : "Clique em \"Adicionar Aluno\" para começar"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      <DialogAdicionarAluno open={dialogAdd} onClose={() => setDialogAdd(false)} />
      {alunoSelecionado !== null && (
        <PainelAluno
          alunoId={alunoSelecionado}
          onClose={() => setAlunoSelecionado(null)}
        />
      )}
    </AppLayout>
  );
}

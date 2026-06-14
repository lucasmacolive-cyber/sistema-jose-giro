// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.js";
import { impressoesTable, alertasTable, configuracoesTable } from "../lib/db/index.js";
import { eq, desc, not, ne, inArray, like } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";

const router = Router();
const UPLOADS_DIR = process.env.VERCEL 
  ? path.join("/tmp", "uploads", "impressoes")
  : path.join(process.cwd(), "uploads", "impressoes");

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.error("Aviso: Não foi possível criar a pasta de uploads (comum no Vercel):", err.message);
}

async function saveFile(buffer: Buffer, ext: string, mimeType: string): Promise<string> {
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;
  const localPath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(localPath, buffer);
  return filename;
}

router.get("/impressoes", async (_req, res) => {
  const impressoes = await db.select().from(impressoesTable).orderBy(desc(impressoesTable.dataPedido));
  res.json(impressoes);
});

router.post("/impressoes", multer({ storage: multer.memoryStorage() }).single("arquivo"), async (req, res) => {
  try {
    const { professorSolicitante, quantidadeCopias, dataParaUso, horarioImpressao, observacoes, duplex, colorida, impressoraNome } = req.body;
    let linkArquivo = req.body.linkArquivo || "";
    let nomeArquivo = null;
    let tipoArquivo = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const filename = await saveFile(req.file.buffer, ext, req.file.mimetype);
      linkArquivo = `/api/impressoes/arquivo/${filename}`;
      nomeArquivo = req.file.originalname;
      tipoArquivo = req.file.mimetype;
    }
    const [nova] = await db.insert(impressoesTable).values({
      professorSolicitante, linkArquivo, nomeArquivo, tipoArquivo, observacoes, 
      quantidadeCopias: Number(quantidadeCopias), duplex: duplex === "true" || duplex === true,
      colorida: colorida === "true" || colorida === true,
      impressoraNome,
      dataParaUso, horarioImpressao, status: "Pendente", lido: false,
      arquivoConteudo: req.file ? req.file.buffer.toString("base64") : null
    }).returning();
    res.status(201).json(nova);
  } catch (err: any) { res.status(500).json({ erro: err.message }); }
});

router.get("/impressoes/arquivo/:filename", async (req, res) => {
  const { filename } = req.params;
  const p = path.join(UPLOADS_DIR, filename);
  
  // Se existir localmente (ambiente dev), manda direto
  if (fs.existsSync(p)) return res.sendFile(p); 

  // Se não, busca no banco de dados (ambiente Vercel)
  try {
    const jobs = await db.select().from(impressoesTable).where(like(impressoesTable.linkArquivo, `%${filename}%`)).limit(1);
    const job = jobs[0];

    if (job && job.arquivoConteudo) {
      const buffer = Buffer.from(job.arquivoConteudo, "base64");
      res.setHeader("Content-Type", job.tipoArquivo || "application/octet-stream");
      return res.send(buffer);
    }
    res.status(404).send("Arquivo não encontrado no banco nem no disco.");
  } catch (err) {
    res.status(500).send("Erro ao buscar arquivo: " + err.message);
  }
});

router.get("/impressoes/pendentes", async (_req, res) => {
  const jobs = await db.select().from(impressoesTable).where(eq(impressoesTable.status, "Pendente"));
  const agora = new Date();
  const filtrados = jobs.filter(j => {
    if (!j.dataParaUso) return true;
    
    // Obtém o horário atual em Brasília (UTC-3)
    const agoraBr = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
    
    // Constrói a data agendada (YYYY-MM-DDTHH:mm:00)
    const agendadoStr = `${j.dataParaUso}T${j.horarioImpressao || "00:00"}:00`;
    const agendado = new Date(agendadoStr);
    
    return agoraBr >= agendado;
  });
  res.json(filtrados);
});

router.post("/impressoes/:id/imprimir-agora", async (req, res) => {
  await db.update(impressoesTable).set({ dataParaUso: null, horarioImpressao: null, status: "Pendente" }).where(eq(impressoesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.patch("/impressoes/:id/status", async (req, res) => {
  const { status, progresso, mensagemStatus } = req.body;
  const up: any = { lido: true };
  if (status) up.status = status;
  if (progresso !== undefined) up.progresso = progresso;
  if (mensagemStatus !== undefined) up.mensagemStatus = mensagemStatus;
  if (status === "Impresso") { up.imprimiuEm = new Date(); up.progresso = 100; }
  await db.update(impressoesTable).set(up).where(eq(impressoesTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.post("/impressoes/heartbeat", async (req, res) => {
  try {
    const isOnline = req.body.printerOnline !== false;
    if (isOnline) {
      const agora = new Date().toISOString();
      await db.insert(configuracoesTable).values({ chave: "last_heartbeat_impressora", valor: agora })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: agora, atualizadoEm: new Date() } });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro no heartbeat:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/impressoes/status-agente", async (_req, res) => {
  const [c] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "last_heartbeat_impressora")).limit(1);
  const online = c ? (Date.now() - new Date(c.valor).getTime() < 40000) : false;
  res.json({ online });
});

router.get("/impressoes/script-impressora", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(gerarPython(getApiBase(req)));
});

router.get("/impressoes/impressora-loop.vbs", (_req, res) => {
  const vbs = `Dim WshShell, pyScript\nSet WshShell = CreateObject("WScript.Shell")\npyScript = WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\\SistemaImpressao\\impressora_escola.py"\nDo\n    WshShell.Run "python " & Chr(34) & pyScript & Chr(34), 0, True\n    WScript.Sleep 5000\nLoop`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"impressora-loop.vbs\"");
  res.send(vbs);
});

router.get("/impressoes/iniciar-impressora.bat", (req, res) => {
  const b = getApiBase(req);
  res.setHeader("Content-Type", "application/x-msdos-program");
  res.setHeader("Content-Disposition", "attachment; filename=\"iniciar-impressora.bat\"");
  res.send(`@echo off
title Robo de Impressao - EM Jose Giro
echo ==================================================
echo   INSTALACAO E ATUALIZACAO DO ROBO DE IMPRESSAO
echo ==================================================
echo.
echo 1. Encerrando processos antigos...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im pythonw.exe >nul 2>&1
taskkill /f /im wscript.exe >nul 2>&1
echo.
echo 2. Criando pasta dedicada no sistema...
set "SYS_DIR=%USERPROFILE%\\SistemaImpressao"
set "STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
if not exist "%SYS_DIR%" mkdir "%SYS_DIR%"

echo.
echo 3. Baixando arquivos atualizados de: ${b}
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest '${b}/api/impressoes/script-impressora' -OutFile '%SYS_DIR%\\impressora_escola.py'"

echo.
echo 4. Verificando SumatraPDF...
if not exist "%SYS_DIR%\\SumatraPDF.exe" (
  powershell -Command "Invoke-WebRequest 'https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip' -OutFile '%SYS_DIR%\\sumatra.zip'"
  powershell -Command "Expand-Archive -Path '%SYS_DIR%\\sumatra.zip' -DestinationPath '%SYS_DIR%' -Force"
  del "%SYS_DIR%\\sumatra.zip"
)

echo.
echo 5. Verificando bibliotecas...
python -m pip install requests img2pdf pdfplumber Pillow --quiet

echo.
echo 6. Configurando inicializacao automatica...
set "PYTHON_EXE="
for /f "delims=" %%i in ('where python 2^>nul') do (
  echo %%i | findstr /i "WindowsApps" >nul
  if errorlevel 1 (
    if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
  )
)

if not defined PYTHON_EXE (
  set "PYTHON_EXE=python.exe"
)

set "PYTHONW_EXE=%PYTHON_EXE:python.exe=pythonw.exe%"

echo pyScript = "%SYS_DIR%\\impressora_escola.py" > "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo Set WshShell = CreateObject("WScript.Shell") >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo Do >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo     WshShell.Run Chr(34) ^& "%PYTHONW_EXE%" ^& Chr(34) ^& " " ^& Chr(34) ^& pyScript ^& Chr(34), 0, True >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo     WScript.Sleep 5000 >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo Loop >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"

echo.
echo 7. Iniciando robo em segundo plano...
start "" wscript.exe "%STARTUP_DIR%\\robo-impressao-escola.vbs"

echo.
echo ==================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo   O robo ja esta rodando oculto no sistema.
echo   Ele vai iniciar automaticamente com o Windows.
echo ==================================================
pause`);
});

router.post("/impressoes/acao/limpar-historico", async (_req, res) => {
  try {
    const deleted = await db.delete(impressoesTable)
      .returning({ id: impressoesTable.id });
    console.log("Histórico limpo. Deletados:", deleted.length, "registros.");
    res.json({ ok: true, deleted: deleted.length });
  } catch (err: any) {
    console.error("Erro ao limpar historico:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/impressoes/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(impressoesTable).where(eq(impressoesTable.id, id));
  res.json({ ok: true });
});

function getApiBase(req: any) {
  let host = req.get("host");
  let proto = req.protocol;
  if (host?.includes("localhost")) proto = "http";
  else proto = "https";
  return `${proto}://${host}`;
}

function gerarPython(apiBase: string) {
  return `import os, sys, time, tempfile, subprocess, requests, img2pdf, re

API = "${apiBase}"
LOG_FILE = os.path.join(os.path.expanduser("~"), "SistemaImpressao", "robo_log.txt")

def log(msg):
    try:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")
    except:
        pass
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\\n")
    except:
        pass

log("=== ROBO INICIADO ===")
log(f"Conectando em: {API}")

try:
    log("Listando impressoras disponiveis no Windows:")
    printers = subprocess.check_output(["powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], text=True).splitlines()
    for p in printers:
        log(f" - {p.strip()}")
except:
    log("Erro ao listar impressoras.")

def check_printer_online():
    try:
        out = subprocess.check_output([
            "powershell", 
            "-Command", 
            "Get-CimInstance Win32_Printer | Where-Object { ($_.Name -match 'RICOH' -or $_.Name -match 'EPSON') -and $_.PrinterStatus -eq 3 } | Select-Object Name | Measure-Object | Select-Object -ExpandProperty Count"
        ], text=True).strip()
        return int(out) > 0
    except:
        return False

def heart():
    try:
        is_on = check_printer_online()
        r = requests.post(f"{API}/api/impressoes/heartbeat", json={"printerOnline": is_on}, timeout=5)
        if r.status_code != 200:
            log(f"Erro no heartbeat: Status {r.status_code}")
    except Exception as e:
        log(f"Falha de conexao no heartbeat: {e}")

def proc(job):
    jid = job["id"]
    name = job.get("nomeArquivo") or "arquivo"
    try:
        log(f"Processando: {name}")
        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Imprimindo","progresso":30,"mensagemStatus":"Baixando..."})
        
        url = job.get("linkArquivo", "")
        is_pdf = "pdf" in job.get("tipoArquivo","").lower() or name.lower().endswith(".pdf")
        is_html = "html" in job.get("tipoArquivo","").lower() or name.lower().endswith(".html") or name.lower().endswith(".htm")

        if not url.startswith("http"):
            url = f"{API}{url}"
            
        # Converter Link do Google Drive para Download Direto PDF
        if "drive.google.com" in url:
            match = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
            if match:
                file_id = match.group(1)
                log(f"Link do Google Drive detectado. Baixando PDF direto (ID: {file_id})...")
                url = f"https://drive.google.com/uc?export=download&id={file_id}"
                is_pdf = True
                is_html = False

        r = requests.get(url, stream=True)
        
        ext = ".pdf" if is_pdf else (".html" if is_html else ".png")
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        for c in r.iter_content(8192):
            tf.write(c)
        tf.close()
        
        print_file = tf.name
        
        if is_html:
            log("Convertendo HTML para PDF usando MS Edge...")
            pdf_path = print_file + ".pdf"
            edge_path = r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
            if os.path.exists(edge_path):
                try:
                    cmd = [edge_path, "--headless", "--disable-gpu", f"--print-to-pdf={pdf_path}", print_file]
                    subprocess.run(cmd, check=True, timeout=30)
                    os.unlink(print_file)
                    print_file = pdf_path
                    is_pdf = True
                except Exception as e:
                    log(f"Falha na conversao de HTML para PDF com Edge: {e}")
                    raise e
            else:
                log("MS Edge nao encontrado para converter HTML.")
                raise Exception("MS Edge nao encontrado para conversao de HTML")
        elif not is_pdf:
            log("Convertendo imagem para PDF...")
            pdf_path = print_file + ".pdf"
            try:
                from PIL import Image
                log("Usando Pillow para processar imagem...")
                with Image.open(print_file) as img:
                    # Converte para RGB para garantir compatibilidade maxima com img2pdf
                    img.convert("RGB").save(print_file + ".jpg", "JPEG", quality=90)
                
                with open(print_file + ".jpg", "rb") as f_in, open(pdf_path, "wb") as f_out:
                    f_out.write(img2pdf.convert(f_in))
                
                os.unlink(print_file + ".jpg")
                os.unlink(print_file)
                print_file = pdf_path
            except Exception as e:
                log(f"Falha ao processar imagem com Pillow: {e}. Tentando conversao direta...")
                with open(print_file, "rb") as f_in, open(pdf_path, "wb") as f_out:
                    f_out.write(img2pdf.convert(f_in))
                os.unlink(print_file)
                print_file = pdf_path

        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Imprimindo","progresso":70,"mensagemStatus":"Enviando para a impressora..."})
        
        # Garante que colorida seja booleano
        is_color = job.get("colorida")
        if is_color is None: is_color = False
        if isinstance(is_color, str): is_color = is_color.lower() == "true"
        
        # Escolha da impressora
        target_printer = None
        try:
            printers = [p.strip() for p in subprocess.check_output(["powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], text=True).splitlines() if p.strip()]
            
            # 1. Prioridade para impressora especifica no job
            pref = job.get("impressoraNome")
            if pref:
                log(f"Preferencia de impressora: {pref}")
                for p in printers:
                    if pref.upper() in p.upper():
                        target_printer = p
                        break
            
            # 2. Se nao encontrou ou nao tinha pref, usa logica de colorida
            if not target_printer:
                is_color = job.get("colorida")
                if is_color is None: is_color = False
                if isinstance(is_color, str): is_color = is_color.lower() == "true"
                
                search_term = "EPSON" if is_color else "RICOH"
                if not is_color: search_term = "3710" # Ricoh SP 3710
                
                for p in printers:
                    if search_term.upper() in p.upper():
                        target_printer = p
                        # Prioridade para PCL 6 na Ricoh
                        if not is_color and "PCL 6" in p.upper():
                            break
            
            # 3. Fallback
            if not target_printer and printers:
                target_printer = printers[0]
        except Exception as e:
            log(f"Erro ao selecionar impressora: {e}")

        log(f"Impressora selecionada: {target_printer or 'Padrao'}")
        
        # Tenta imprimir usando SumatraPDF se existir, ou PowerShell como fallback forte
        success = False
        sumatra = os.path.join(os.path.expanduser("~"), "SistemaImpressao", "SumatraPDF.exe")
        
        if os.path.exists(sumatra):
            try:
                log("Usando SumatraPDF para impressao direta...")
                if target_printer:
                    cmd = [sumatra, "-print-to", target_printer, "-print-settings", "silent", print_file]
                else:
                    cmd = [sumatra, "-print-default", "-print-settings", "silent", print_file]
                
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if res.returncode == 0:
                    success = True
                    log("SumatraPDF enviou com sucesso.")
            except Exception as e:
                log(f"Erro no SumatraPDF: {e}")

        if not success:
            log("Usando metodo alternativo (PowerShell)...")
            try:
                # Constroi o comando de forma mais simples para evitar erros de sintaxe
                if target_printer:
                    p_arg = f'"{target_printer}"'
                    cmd = f"Start-Process -FilePath '{print_file}' -Verb PrintTo -ArgumentList '{p_arg}' -WindowStyle Hidden -Wait"
                else:
                    cmd = f"Start-Process -FilePath '{print_file}' -Verb Print -WindowStyle Hidden -Wait"
                
                subprocess.run(["powershell", "-Command", cmd], timeout=60, check=True)
                success = True
                log("PowerShell enviou com sucesso.")
            except Exception as e:
                log(f"Falha ao imprimir via PowerShell: {e}")
                raise e

        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Impresso", "progresso":100, "mensagemStatus":"Concluido"})
        # Remove arquivos temporarios
        try:
            if os.path.exists(print_file): os.unlink(print_file)
        except: pass
        log("Processo finalizado.")
    except Exception as e:
        log(f"Falha no job {jid}: {e}")
        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Pendente","progresso":0,"mensagemStatus":"Erro, aguardando..."})

while True:
    heart()
    if check_printer_online():
        try:
            r = requests.get(f"{API}/api/impressoes/pendentes", timeout=10)
            if r.status_code == 200:
                for j in r.json():
                    proc(j)
        except:
            pass
    else:
        log("Impressora offline. Impressoes pausadas ate que ela seja ligada...")
    
    for _ in range(10):
        heart()

export default router;

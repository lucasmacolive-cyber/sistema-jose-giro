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
    const { ricohOnline, epsonOnline, ricohStatus, epsonStatus } = req.body;
    const agora = new Date().toISOString();
    
    // Atualiza heartbeat geral do agente
    await db.insert(configuracoesTable).values({ chave: "last_heartbeat_impressora", valor: agora })
      .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: agora, atualizadoEm: new Date() } });

    if (ricohOnline) {
      await db.insert(configuracoesTable).values({ chave: "last_heartbeat_ricoh", valor: agora })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: agora, atualizadoEm: new Date() } });
    }
    if (epsonOnline) {
      await db.insert(configuracoesTable).values({ chave: "last_heartbeat_epson", valor: agora })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: agora, atualizadoEm: new Date() } });
    }

    let pingMsg = `Ricoh: ${ricohOnline ? "ONLINE" : "OFFLINE"}`;
    if (ricohStatus) pingMsg += ` (${ricohStatus})`;
    pingMsg += `, Epson: ${epsonOnline ? "ONLINE" : "OFFLINE"}`;
    if (epsonStatus) pingMsg += ` (${epsonStatus})`;

    const time = new Date().toLocaleTimeString("pt-BR");
    const line = `[${time}] ${pingMsg}`;

    try {
      const resLog = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "impressoras_pings_log")).limit(1);
      let logs = [];
      if (resLog.length > 0) {
        try { logs = JSON.parse(resLog[0].valor); } catch(e){}
      }
      logs.push(line);
      if (logs.length > 50) logs.shift();
      await db.insert(configuracoesTable).values({ chave: "impressoras_pings_log", valor: JSON.stringify(logs) })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: JSON.stringify(logs), atualizadoEm: new Date() } });
    } catch (e) {
      console.error("Erro ao salvar logs de pings:", e);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro no heartbeat:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/impressoes/status-agente", async (_req, res) => {
  try {
    const [c] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "last_heartbeat_impressora")).limit(1);
    const [r] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "last_heartbeat_ricoh")).limit(1);
    const [e] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "last_heartbeat_epson")).limit(1);
    
    const online = c ? (Date.now() - new Date(c.valor).getTime() < 45000) : false;
    const ricohOnline = r ? (Date.now() - new Date(r.valor).getTime() < 45000) : false;
    const epsonOnline = e ? (Date.now() - new Date(e.valor).getTime() < 45000) : false;
    
    res.json({ online, ricohOnline, epsonOnline });
  } catch (err) {
    res.json({ online: false, ricohOnline: false, epsonOnline: false });
  }
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
  return `import os, sys, time, tempfile, subprocess, requests, img2pdf, re, socket, json as _json

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
    log("Impressoras no Windows:")
    printers = subprocess.check_output(["powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], text=True, creationflags=0x08000000).splitlines()
    for p in printers:
        log(f"  - {p.strip()}")
except:
    log("Erro ao listar impressoras.")

def _ping(ip):
    """Retorna True se o IP responde ao ping."""
    try:
        res = subprocess.call(["ping", "-n", "1", "-w", "800", ip],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              creationflags=0x08000000)
        return res == 0
    except:
        return False

def _tcp_open(ip, port=9100, timeout=1.5):
    """Retorna True se a porta TCP do IP estiver aberta (impressora acordada)."""
    try:
        s = socket.create_connection((ip, port), timeout=timeout)
        s.close()
        return True
    except:
        return False

def _win32_status(name_match):
    """
    Consulta o Win32_Printer via PowerShell.
    PrinterStatus: 3=Idle, 4=Printing -> online | 7=Power Save -> descanso
    """
    try:
        cmd = f"Get-CimInstance Win32_Printer | Where-Object {{ $_.Name -match '{name_match}' }} | Select-Object Name, PrinterStatus | ConvertTo-Json"
        out = subprocess.check_output(["powershell", "-Command", cmd],
                                      text=True, creationflags=0x08000000, timeout=5).strip()
        if not out:
            return None
        data = _json.loads(out)
        if isinstance(data, dict):
            data = [data]
        for d in data:
            st = d.get("PrinterStatus", 0)
            if st in (3, 4):
                return "online"
            if st == 7:
                return "descanso"
        return "offline"
    except:
        return None

def check_printer_status(ip, name_match):
    """
    'offline'  : sem resposta de ping
    'descanso' : ping ok mas porta 9100 fechada (modo sleep)
    'online'   : ping ok E (porta 9100 aberta OU Win32 diz Idle/Printing)
    """
    if not ip or not re.match(r"^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$", ip.strip()):
        return "offline"
    ip = ip.strip()
    if not _ping(ip):
        return "offline"
    tcp = _tcp_open(ip, 9100) or _tcp_open(ip, 80)
    win32 = _win32_status(name_match)
    if tcp or win32 == "online":
        return "online"
    if win32 == "descanso":
        return "descanso"
    return "descanso"

def get_ips():
    try:
        r = requests.get(f"{API}/api/escola/contatos", timeout=4)
        if r.status_code == 200:
            cfg = r.json()
            return cfg.get("impressora_ricoh_ip", ""), cfg.get("impressora_epson_ip", "")
    except Exception as e:
        log(f"Erro ao buscar IPs: {e}")
    return "", ""

def heart(ricoh_st, epson_st):
    try:
        requests.post(f"{API}/api/impressoes/heartbeat", json={
            "ricohOnline": ricoh_st != "offline",
            "epsonOnline": epson_st != "offline",
            "ricohStatus": ricoh_st,
            "epsonStatus": epson_st,
        }, timeout=5)
    except Exception as e:
        log(f"Falha heartbeat: {e}")

def proc(job):
    jid = job["id"]
    name = job.get("nomeArquivo") or "arquivo"
    try:
        log(f"Processando: {name}")
        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Imprimindo","progresso":30,"mensagemStatus":"Baixando..."})
        
        url = job.get("linkArquivo", "")
        is_pdf = "pdf" in (job.get("tipoArquivo") or "").lower() or name.lower().endswith(".pdf")
        is_html = "html" in (job.get("tipoArquivo") or "").lower() or name.lower().endswith(".html") or name.lower().endswith(".htm")

        if not url.startswith("http"):
            url = f"{API}{url}"
            
        # Google Drive -> download direto
        if "drive.google.com" in url:
            m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
            if m:
                url = f"https://drive.google.com/uc?export=download&id={m.group(1)}"
                is_pdf = True
                is_html = False

        r = requests.get(url, stream=True, timeout=30)
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
                    subprocess.run(cmd, check=True, timeout=30, creationflags=0x08000000)
                    os.unlink(print_file)
                    print_file = pdf_path
                    is_pdf = True
                except Exception as e:
                    log(f"Falha na conversao HTML->PDF: {e}")
                    raise e
            else:
                raise Exception("MS Edge nao encontrado para conversao de HTML")
        elif not is_pdf:
            log("Convertendo imagem para PDF...")
            pdf_path = print_file + ".pdf"
            try:
                from PIL import Image
                with Image.open(print_file) as img:
                    img.convert("RGB").save(print_file + ".jpg", "JPEG", quality=90)
                with open(print_file + ".jpg", "rb") as f_in, open(pdf_path, "wb") as f_out:
                    f_out.write(img2pdf.convert(f_in))
                os.unlink(print_file + ".jpg")
                os.unlink(print_file)
                print_file = pdf_path
            except Exception as e:
                log(f"Falha ao processar imagem: {e}")
                with open(print_file, "rb") as f_in, open(pdf_path, "wb") as f_out:
                    f_out.write(img2pdf.convert(f_in))
                os.unlink(print_file)
                print_file = pdf_path

        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Imprimindo","progresso":70,"mensagemStatus":"Enviando para a impressora..."})
        
        # Escolha da impressora
        target_printer = None
        try:
            printers = [p.strip() for p in subprocess.check_output(["powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], text=True, creationflags=0x08000000).splitlines() if p.strip()]
            pref = job.get("impressoraNome")
            if pref:
                for p in printers:
                    if pref.upper() in p.upper():
                        target_printer = p; break
            if not target_printer:
                is_color = job.get("colorida")
                if is_color is None: is_color = False
                if isinstance(is_color, str): is_color = is_color.lower() == "true"
                for term in (["EPSON"] if is_color else ["3710", "RICOH"]):
                    for p in printers:
                        if term.upper() in p.upper():
                            target_printer = p; break
                    if target_printer: break
            if not target_printer and printers:
                target_printer = printers[0]
        except Exception as e:
            log(f"Erro ao selecionar impressora: {e}")

        log(f"Impressora selecionada: {target_printer or 'Padrao'}")
        success = False
        import glob
        sumatra_dir = os.path.join(os.path.expanduser("~"), "SistemaImpressao")
        sumatra = os.path.join(sumatra_dir, "SumatraPDF.exe")
        if not os.path.exists(sumatra):
            matches = glob.glob(os.path.join(sumatra_dir, "SumatraPDF*.exe"))
            if matches:
                sumatra = matches[0]
        
        if os.path.exists(sumatra):
            try:
                log(f"Usando SumatraPDF em: {sumatra}...")
                cmd = [sumatra, "-print-to", target_printer, "-print-settings", "silent", print_file] if target_printer else [sumatra, "-print-default", "-print-settings", "silent", print_file]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=30, creationflags=0x08000000)
                if res.returncode == 0:
                    success = True
                    log("SumatraPDF enviou com sucesso.")
            except Exception as e:
                log(f"Erro no SumatraPDF: {e}")

        if not success:
            log("Usando metodo alternativo (PowerShell)...")
            try:
                if target_printer:
                    p_arg = f'"{target_printer}"'
                    ps_cmd = f"Start-Process -FilePath '{print_file}' -Verb PrintTo -ArgumentList '{p_arg}' -WindowStyle Hidden -Wait"
                else:
                    ps_cmd = f"Start-Process -FilePath '{print_file}' -Verb Print -WindowStyle Hidden -Wait"
                subprocess.run(["powershell", "-Command", ps_cmd], timeout=60, check=True, creationflags=0x08000000)
                success = True
                log("PowerShell enviou com sucesso.")
            except Exception as e:
                log(f"Falha ao imprimir via PowerShell: {e}")
                raise e

        requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Impresso", "progresso":100, "mensagemStatus":"Concluido"})
        try:
            if os.path.exists(print_file): os.unlink(print_file)
        except: pass
        log("Processo finalizado.")
    except Exception as e:
        log(f"Falha no job {jid}: {e}")
        try:
            requests.patch(f"{API}/api/impressoes/{jid}/status", json={"status":"Pendente","progresso":0,"mensagemStatus":"Erro, aguardando..."})
        except: pass

# ──────────────────────────────────────
# Loop principal
# ──────────────────────────────────────
ricoh_st = "offline"
epson_st = "offline"
status_counter = 0   # checa impressoras a cada 5 iteracoes (~20s)

while True:
    if status_counter == 0:
        ricoh_ip, epson_ip = get_ips()
        ricoh_st = check_printer_status(ricoh_ip, "RICOH")
        epson_st = check_printer_status(epson_ip, "EPSON")
        log(f"Status: RICOH={ricoh_st} EPSON={epson_st}")

    heart(ricoh_st, epson_st)

    if ricoh_st != "offline" or epson_st != "offline":
        try:
            r = requests.get(f"{API}/api/impressoes/pendentes", timeout=10)
            if r.status_code == 200:
                jobs = r.json()
                if jobs:
                    log(f"Processando {len(jobs)} job(s) pendente(s)...")
                for j in jobs:
                    proc(j)
        except Exception as e:
            log(f"Erro ao buscar pendentes: {e}")
    else:
        log("Ambas offline. Impressoes pausadas.")

    status_counter = (status_counter + 1) % 5
    time.sleep(4)
`;
}

router.get("/impressoes/pings-log", async (req, res) => {
  try {
    const row = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "impressoras_pings_log")).limit(1);
    if (row.length > 0) {
      const logs = JSON.parse(row[0].valor);
      res.json(logs);
    } else {
      res.json([]);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
// trigger rebuild


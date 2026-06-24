// @ts-nocheck
import { Router, type IRouter } from "express";
import { db } from "../lib/db/index.ts";
import { impressoesTable, alertasTable, configuracoesTable } from "../lib/db/index.ts";
import { eq, desc, not, ne, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";

const router: IRouter = Router();
const UPLOADS_DIR = path.join(process.cwd(), "uploads", "impressoes");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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
      dataParaUso, horarioImpressao, status: "Pendente", lido: false
    }).returning();
    res.status(201).json(nova);
  } catch (err: any) { res.status(500).json({ erro: err.message }); }
});

router.get("/impressoes/arquivo/:filename", (req, res) => {
  const p = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(p)) res.sendFile(p); else res.status(404).send("Not found");
});

router.get("/impressoes/pendentes", async (_req, res) => {
  const jobs = await db.select().from(impressoesTable).where(eq(impressoesTable.status, "Pendente"));
  const agora = new Date();
  const filtrados = jobs.filter(j => {
    if (!j.dataParaUso) return true;
    const agendado = new Date(`${j.dataParaUso}T${j.horarioImpressao || "00:00"}:00`);
    return agora >= agendado;
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

    if (ricohStatus) {
      await db.insert(configuracoesTable).values({ chave: "ricoh_status", valor: ricohStatus })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: ricohStatus, atualizadoEm: new Date() } });
    }
    if (epsonStatus) {
      await db.insert(configuracoesTable).values({ chave: "epson_status", valor: epsonStatus })
        .onConflictDoUpdate({ target: configuracoesTable.chave, set: { valor: epsonStatus, atualizadoEm: new Date() } });
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
    const [rs] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "ricoh_status")).limit(1);
    const [es] = await db.select().from(configuracoesTable).where(eq(configuracoesTable.chave, "epson_status")).limit(1);
    
    const online = c ? (Date.now() - new Date(c.valor).getTime() < 45000) : false;
    const ricohOnlineVal = r ? (Date.now() - new Date(r.valor).getTime() < 45000) : false;
    const epsonOnlineVal = e ? (Date.now() - new Date(e.valor).getTime() < 45000) : false;
    
    const ricohStatus = ricohOnlineVal ? (rs?.valor || "online") : "offline";
    const epsonStatus = epsonOnlineVal ? (es?.valor || "online") : "offline";
    
    res.json({ 
      online, 
      ricohOnline: ricohStatus !== "offline", 
      epsonOnline: epsonStatus !== "offline",
      ricohStatus,
      epsonStatus
    });
  } catch (err) {
    res.json({ online: false, ricohOnline: false, epsonOnline: false, ricohStatus: "offline", epsonStatus: "offline" });
  }
});

router.get("/impressoes/script-impressora", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(gerarPython(getApiBase(req)));
});

router.get("/impressoes/impressora-loop.vbs", (_req, res) => {
  const vbs = `Dim WshShell, pyScript\nSet WshShell = CreateObject("WScript.Shell")\npyScript = WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\\SistemaImpressao\\impressora_escola.py"\nDo\n    WshShell.Run "python " & Chr(34) & pyScript & Chr(34), 0, True\n    WScript.Sleep 5000\nLoop`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(vbs);
});

router.get("/impressoes/iniciar-impressora.bat", (req, res) => {
  const b = getApiBase(req);
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
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest '${b}/api/impressoes/impressora-loop.vbs' -OutFile '%STARTUP_DIR%\\robo-impressao-escola.vbs'"

echo.
echo 4. Verificando SumatraPDF...
if not exist "%SYS_DIR%\\SumatraPDF.exe" (
  powershell -Command "Invoke-WebRequest 'https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip' -OutFile '%SYS_DIR%\\sumatra.zip'"
  powershell -Command "Expand-Archive -Path '%SYS_DIR%\\sumatra.zip' -DestinationPath '%SYS_DIR%' -Force"
  del "%SYS_DIR%\\sumatra.zip"
)

echo.
echo 5. Verificando bibliotecas...
python -m pip install requests img2pdf pdfplumber --quiet

echo.
echo ==================================================
echo TUDO PRONTO! O robo foi atualizado e configurado!
echo Ele agora vai INICIAR AUTOMATICAMENTE toda vez que 
echo voce ligar o computador!
echo.
echo Pressione QUALQUER TECLA para INICIAR AGORA EM MODO OCULTO.
echo ==================================================
pause
start wscript.exe "%STARTUP_DIR%\\robo-impressao-escola.vbs"
exit`);
});

router.post("/impressoes/acao/limpar-historico", async (_req, res) => {
  try {
    const deleted = await db.delete(impressoesTable)
      .where(inArray(impressoesTable.status, ["Impresso", "Cancelado"]))
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
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost";
  return (host.includes("localhost") ? "http" : "https") + "://" + host;
}

function gerarPython(apiBase: string) {
  return `import os, time, tempfile, subprocess, requests, re, socket, json as _json

API = "${apiBase}"
LOG_FILE = os.path.join(os.path.expanduser("~"), "SistemaImpressao", "robo_log.txt")

def log(msg):
    try:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)
    except: pass
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\\n")
    except: pass

log("=== ROBO INICIADO ===")
log(f"Conectando em: {API}")

try:
    log("Impressoras no Windows:")
    _ps = subprocess.check_output(["powershell", "-Command",
        "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"],
        text=True, creationflags=0x08000000, timeout=8)
    _pdata = _json.loads(_ps.strip())
    if isinstance(_pdata, dict): _pdata = [_pdata]
    for _p in _pdata:
        log(f"  {_p.get('Name','')} -> Status={_p.get('PrinterStatus','?')}")
except Exception as _e:
    log(f"Aviso ao listar impressoras: {_e}")

# ── Helpers de detecção ────────────────────────────────────────────
def _ping(ip, timeout_ms=800):
    try:
        r = subprocess.call(["ping", "-n", "1", "-w", str(timeout_ms), ip],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            creationflags=0x08000000)
        return r == 0
    except: return False

def _tcp(ip, port=9100, timeout=1.5):
    try:
        s = socket.create_connection((ip, port), timeout=timeout)
        s.close(); return True
    except: return False

def _win32_by_name(name_match):
    """
    Consulta Win32_Printer pelo nome (funciona mesmo sem rede, detecta USB e rede local).
    PrinterStatus:
      0 = Other, 1 = Unknown, 2 = Idle (DISPONIVEL)
      3 = Printing, 4 = Warmup (IMPRIMINDO/AQUECENDO)
      5 = Stop Printing, 6 = Offline
      7 = Power Save (MODO ESPERA)
    Retorna: 'online', 'descanso', 'offline', ou None se nao encontrar
    """
    try:
        cmd = f"Get-CimInstance Win32_Printer | Where-Object {{ $_.Name -match '{name_match}' }} | Select-Object Name,PrinterStatus,WorkOffline | ConvertTo-Json"
        out = subprocess.check_output(["powershell", "-Command", cmd],
                                      text=True, creationflags=0x08000000, timeout=6).strip()
        if not out: return None
        data = _json.loads(out)
        if isinstance(data, dict): data = [data]
        for d in data:
            if d.get("WorkOffline"): continue  # marcado como offline no Windows
            st = d.get("PrinterStatus", 0)
            if st in (2, 3, 4): return "online"   # Idle, Printing, Warmup
            if st == 7:         return "descanso"  # Power Save
            if st == 6:         continue           # Offline marcado
        # Se achou impressoras mas nenhuma boa, retorna descanso (pode ser estado transitório)
        return "descanso"
    except: return None

def _win32_by_ip(ip):
    """Busca Win32_Printer pela porta IP (PortName contendo o IP)."""
    try:
        cmd = f"Get-CimInstance Win32_Printer | Where-Object {{ $_.PortName -like '*{ip}*' }} | Select-Object Name,PrinterStatus,WorkOffline | ConvertTo-Json"
        out = subprocess.check_output(["powershell", "-Command", cmd],
                                      text=True, creationflags=0x08000000, timeout=6).strip()
        if not out: return None
        data = _json.loads(out)
        if isinstance(data, dict): data = [data]
        for d in data:
            if d.get("WorkOffline"): continue
            st = d.get("PrinterStatus", 0)
            if st in (2, 3, 4): return "online"
            if st == 7:         return "descanso"
        return "descanso"
    except: return None

def check_printer(ip, name_match):
    """
    Estratégia em 3 camadas (da mais confiável para a menos):
    1. Win32_Printer por nome -> detecta USB e rede local sem depender de ping
    2. Win32_Printer por IP de porta -> confirma pelo IP configurado no Windows
    3. Ping + TCP -> para impressoras de rede não registradas no Windows
    Retorna: 'online', 'descanso', ou 'offline'
    """
    # Camada 1: Win32 por nome (mais confiável, independente de rede)
    w_name = _win32_by_name(name_match)
    if w_name == "online":   return "online"
    if w_name == "descanso": return "descanso"

    # Camada 2: Win32 por IP (caso o nome seja diferente do esperado)
    has_ip = ip and re.match(r"^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$", ip.strip())
    if has_ip:
        w_ip = _win32_by_ip(ip.strip())
        if w_ip == "online":   return "online"
        if w_ip == "descanso": return "descanso"

    # Camada 3: Ping + TCP (rede)
    if has_ip:
        ip = ip.strip()
        if not _ping(ip): return "offline"
        # Ping respondeu -> está na rede, verifica se acordada
        if _tcp(ip, 9100) or _tcp(ip, 80): return "online"
        return "descanso"  # Ping ok mas porta fechada = modo sleep

    return "offline"

# ── IPs configurados no sistema ───────────────────────────────────
def get_ips():
    try:
        r = requests.get(f"{API}/api/escola/contatos", timeout=5)
        if r.status_code == 200:
            cfg = r.json()
            return cfg.get("impressora_ricoh_ip",""), cfg.get("impressora_epson_ip","")
    except Exception as e:
        log(f"Erro ao buscar IPs: {e}")
    return "", ""

# ── Heartbeat ─────────────────────────────────────────────────────
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

# ── Processar job de impressão ────────────────────────────────────
def proc(job):
    jid = job["id"]
    name = job.get("nomeArquivo") or "arquivo"
    try:
        log(f"Processando job #{jid}: {name}")
        requests.patch(f"{API}/api/impressoes/{jid}/status",
                       json={"status":"Imprimindo","progresso":30,"mensagemStatus":"Baixando..."},
                       timeout=5)
        url = job.get("linkArquivo", "")
        is_pdf = "pdf" in (job.get("tipoArquivo") or "").lower() or name.lower().endswith(".pdf")
        if not url.startswith("http"): url = f"{API}{url}"
        # Google Drive -> download direto
        if "drive.google.com" in url:
            m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
            if m: url = f"https://drive.google.com/uc?export=download&id={m.group(1)}"; is_pdf=True
        r = requests.get(url, stream=True, timeout=30)
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf" if is_pdf else ".png")
        for chunk in r.iter_content(8192): tf.write(chunk)
        tf.close()
        print_file = tf.name
        # Converter imagem para PDF se necessário
        if not is_pdf:
            try:
                import img2pdf
                pdf_path = print_file + ".pdf"
                with open(print_file,"rb") as fi, open(pdf_path,"wb") as fo: fo.write(img2pdf.convert(fi))
                os.unlink(print_file); print_file = pdf_path
            except Exception as ce: log(f"Conversao imagem: {ce}")
        requests.patch(f"{API}/api/impressoes/{jid}/status",
                       json={"status":"Imprimindo","progresso":70,"mensagemStatus":"Enviando para impressora..."},
                       timeout=5)
        # Selecionar impressora
        target = None
        try:
            ps_list = [p.strip() for p in subprocess.check_output(
                ["powershell","-Command","Get-Printer | Select-Object -ExpandProperty Name"],
                text=True, creationflags=0x08000000).splitlines() if p.strip()]
            pref = job.get("impressoraNome","")
            if pref:
                for p in ps_list:
                    if pref.upper() in p.upper(): target=p; break
            if not target:
                is_color = job.get("colorida", False)
                if isinstance(is_color,str): is_color = is_color.lower()=="true"
                for term in (["EPSON"] if is_color else ["3710","RICOH","SP 3"]):
                    for p in ps_list:
                        if term.upper() in p.upper(): target=p; break
                    if target: break
            if not target and ps_list: target = ps_list[0]
        except Exception as se: log(f"Selecao impressora: {se}")
        log(f"Impressora: {target or 'Padrao'}")
        # Imprimir via SumatraPDF ou PowerShell
        ok = False
        import glob
        sumatra_dir = os.path.join(os.path.expanduser("~"), "SistemaImpressao")
        sumatra = os.path.join(sumatra_dir, "SumatraPDF.exe")
        if not os.path.exists(sumatra):
            matches = glob.glob(os.path.join(sumatra_dir, "SumatraPDF*.exe"))
            if matches:
                sumatra = matches[0]

        if os.path.exists(sumatra):
            try:
                cmd = [sumatra,"-print-to",target,"-print-settings","silent",print_file] if target \
                      else [sumatra,"-print-default","-print-settings","silent",print_file]
                if subprocess.run(cmd, timeout=30, creationflags=0x08000000).returncode==0: ok=True
            except: pass
        if not ok:
            try:
                ps = f"Start-Process -FilePath '{print_file}' -Verb PrintTo -ArgumentList '\\\"{target}\\\"' -WindowStyle Hidden -Wait" if target \
                     else f"Start-Process -FilePath '{print_file}' -Verb Print -WindowStyle Hidden -Wait"
                subprocess.run(["powershell","-Command",ps], timeout=60, check=True, creationflags=0x08000000)
                ok = True
            except Exception as pe: log(f"Erro PowerShell: {pe}")
        requests.patch(f"{API}/api/impressoes/{jid}/status",
                       json={"status":"Impresso","progresso":100,"mensagemStatus":"Concluido"},
                       timeout=5)
        try:
            if os.path.exists(print_file): os.unlink(print_file)
        except: pass
        log(f"Job #{jid} concluido!")
    except Exception as e:
        log(f"Falha job #{jid}: {e}")
        try: requests.patch(f"{API}/api/impressoes/{jid}/status",
                            json={"status":"Pendente","progresso":0,"mensagemStatus":"Erro, aguardando..."},
                            timeout=5)
        except: pass

# ── Loop principal ────────────────────────────────────────────────
ricoh_st = "offline"
epson_st = "offline"
counter = 0  # checa rede/Win32 a cada 5 ciclos = ~20s

while True:
    if counter == 0:
        ricoh_ip, epson_ip = get_ips()
        ricoh_st = check_printer("RICOH", ricoh_ip)
        epson_st = check_printer("EPSON", epson_ip)
        log(f"Status: RICOH={ricoh_st}  EPSON={epson_st}")

    heart(ricoh_st, epson_st)

    if ricoh_st != "offline" or epson_st != "offline":
        try:
            r = requests.get(f"{API}/api/impressoes/pendentes", timeout=10)
            if r.status_code == 200:
                jobs = r.json()
                if jobs: log(f"{len(jobs)} job(s) na fila...")
                for j in jobs: proc(j)
        except Exception as e:
            log(f"Erro jobs: {e}")
    else:
        log("Ambas offline. Aguardando...")

    counter = (counter + 1) % 5
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
// @ts-nocheck
import { Router } from "express";
import { db } from "../lib/db/index.ts";
import { impressoesTable, alertasTable, configuracoesTable } from "../lib/db/index.ts";
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
} catch (err: any) {
  console.error("Aviso: Não foi possível criar a pasta de uploads:", err.message);
}

async function saveFile(buffer: Buffer, ext: string): Promise<string> {
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;
  const localPath = path.join(UPLOADS_DIR, filename);
  try {
    await fs.promises.writeFile(localPath, buffer);
  } catch {}
  return filename;
}

export function normalizarLinkExterno(rawUrl: string): {
  downloadUrl: string;
  forcedExt?: string;
  forcedMime?: string;
} {
  const url = (rawUrl || "").trim();
  if (!url) return { downloadUrl: "" };

  // Google Docs -> export PDF
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return {
      downloadUrl: `https://docs.google.com/document/d/${docsMatch[1]}/export?format=pdf`,
      forcedExt: ".pdf",
      forcedMime: "application/pdf",
    };
  }

  // Google Sheets -> export PDF
  const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetsMatch) {
    return {
      downloadUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/export?format=pdf`,
      forcedExt: ".pdf",
      forcedMime: "application/pdf",
    };
  }

  // Google Slides -> export PDF
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    return {
      downloadUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/pdf`,
      forcedExt: ".pdf",
      forcedMime: "application/pdf",
    };
  }

  // Google Drive file (/file/d/ID or ?id=ID)
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return {
      downloadUrl: `https://drive.google.com/uc?export=download&confirm=t&id=${driveMatch[1]}`,
      forcedExt: ".pdf",
      forcedMime: "application/pdf",
    };
  }

  // Dropbox sharing link
  if (url.includes("dropbox.com")) {
    const dlUrl = url.replace(/\?dl=0$/, "?dl=1").replace(/&dl=0$/, "&dl=1");
    return { downloadUrl: dlUrl.includes("dl=1") ? dlUrl : `${dlUrl}${dlUrl.includes("?") ? "&" : "?"}dl=1` };
  }

  return { downloadUrl: url };
}

router.get("/impressoes", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const impressoes = await db.select().from(impressoesTable).orderBy(desc(impressoesTable.dataPedido));
  res.json(impressoes);
});

router.get("/impressoes/pedido/:id", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ erro: "ID inválido" });
    const [job] = await db.select().from(impressoesTable).where(eq(impressoesTable.id, id)).limit(1);
    if (!job) return res.status(404).json({ erro: "Pedido não encontrado" });
    res.json({
      id: job.id,
      professorSolicitante: job.professorSolicitante,
      nomeArquivo: job.nomeArquivo,
      linkArquivo: job.linkArquivo,
      quantidadeCopias: job.quantidadeCopias,
      duplex: job.duplex,
      colorida: job.colorida,
      impressoraNome: job.impressoraNome,
      status: job.status,
      progresso: job.progresso,
      mensagemStatus: job.mensagemStatus,
      dataPedido: job.dataPedido,
      imprimiuEm: job.imprimiuEm,
    });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

router.post("/impressoes", multer({ storage: multer.memoryStorage() }).single("arquivo"), async (req, res) => {
  try {
    const {
      professorSolicitante,
      quantidadeCopias,
      dataParaUso,
      horarioImpressao,
      observacoes,
      duplex,
      colorida,
      impressoraNome,
    } = req.body;
    let linkArquivo = (req.body.linkArquivo || "").trim();
    let nomeArquivo = req.body.nomeArquivo || null;
    let tipoArquivo = null;
    let arquivoConteudo: string | null = null;

    if (req.file) {
      const ext = path.extname(req.file.originalname) || ".pdf";
      const filename = await saveFile(req.file.buffer, ext);
      linkArquivo = `/api/impressoes/arquivo/${filename}`;
      nomeArquivo = req.file.originalname;
      tipoArquivo = req.file.mimetype;
      arquivoConteudo = req.file.buffer.toString("base64");
    } else if (linkArquivo) {
      const norm = normalizarLinkExterno(linkArquivo);
      linkArquivo = norm.downloadUrl;
      try {
        const u = new URL(linkArquivo);
        const baseName = decodeURIComponent(path.basename(u.pathname)).replace(/[^a-zA-Z0-9._-]/g, "_");
        if (!nomeArquivo) {
          nomeArquivo = baseName && baseName !== "uc" && baseName !== "export" ? baseName : "Documento via Link.pdf";
        }
      } catch {
        if (!nomeArquivo) nomeArquivo = "Documento via Link.pdf";
      }

      // Tenta baixar e armazenar em cache no banco para garantir entrega imediata ao robô
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(linkArquivo, {
          signal: ctrl.signal,
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          redirect: "follow",
        });
        clearTimeout(timer);
        const ctype = (resp.headers.get("content-type") || "").toLowerCase();
        if (resp.ok && !ctype.includes("text/html")) {
          const arrBuf = await resp.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          if (buf.length > 100 && buf.length < 15 * 1024 * 1024) {
            const isPdfBuf = buf.slice(0, 4).toString() === "%PDF" || ctype.includes("pdf") || norm.forcedExt === ".pdf";
            const ext = isPdfBuf
              ? ".pdf"
              : ctype.includes("png")
              ? ".png"
              : ctype.includes("jpeg") || ctype.includes("jpg")
              ? ".jpg"
              : path.extname(nomeArquivo || "") || ".pdf";
            const filename = await saveFile(buf, ext);
            linkArquivo = `/api/impressoes/arquivo/${filename}`;
            tipoArquivo = isPdfBuf ? "application/pdf" : norm.forcedMime || ctype || "application/pdf";
            arquivoConteudo = buf.toString("base64");
            if (nomeArquivo && !nomeArquivo.toLowerCase().endsWith(ext)) {
              nomeArquivo = `${nomeArquivo}${ext}`;
            }
          }
        } else if (norm.forcedMime) {
          tipoArquivo = norm.forcedMime;
        }
      } catch {
        if (norm.forcedMime) tipoArquivo = norm.forcedMime;
      }
    }

    const isColor = colorida === "true" || colorida === true;
    const printerTarget = impressoraNome || (isColor ? "EPSON" : "RICOH");

    const [nova] = await db
      .insert(impressoesTable)
      .values({
        professorSolicitante: professorSolicitante || "Professor(a)",
        linkArquivo,
        nomeArquivo,
        tipoArquivo,
        observacoes,
        quantidadeCopias: Math.max(1, Number(quantidadeCopias) || 1),
        duplex: duplex === "true" || duplex === true,
        colorida: isColor,
        impressoraNome: printerTarget,
        dataParaUso: dataParaUso || null,
        horarioImpressao: horarioImpressao || null,
        status: "Pendente",
        lido: false,
        progresso: 0,
        mensagemStatus: "Na fila de impressão",
        arquivoConteudo,
      })
      .returning();

    res.status(201).json(nova);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

router.get("/impressoes/arquivo/:filename", async (req, res) => {
  const { filename } = req.params;
  const p = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(p)) return res.sendFile(p);

  try {
    const jobs = await db
      .select()
      .from(impressoesTable)
      .where(like(impressoesTable.linkArquivo, `%${filename}%`))
      .limit(1);
    const job = jobs[0];

    if (job && job.arquivoConteudo) {
      const buffer = Buffer.from(job.arquivoConteudo, "base64");
      res.setHeader("Content-Type", job.tipoArquivo || "application/pdf");
      return res.send(buffer);
    }
    res.status(404).send("Arquivo não encontrado no banco nem no disco.");
  } catch (err: any) {
    res.status(500).send("Erro ao buscar arquivo: " + err.message);
  }
});

router.get("/impressoes/pendentes", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const jobs = await db.select().from(impressoesTable).where(eq(impressoesTable.status, "Pendente"));
  const filtrados = jobs.filter((j) => {
    if (!j.dataParaUso) return true;
    const agoraBr = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
    const agendadoStr = `${j.dataParaUso}T${j.horarioImpressao || "00:00"}:00`;
    const agendado = new Date(agendadoStr);
    return agoraBr >= agendado;
  });
  res.json(filtrados);
});

router.post("/impressoes/:id/imprimir-agora", async (req, res) => {
  await db
    .update(impressoesTable)
    .set({
      dataParaUso: null,
      horarioImpressao: null,
      status: "Pendente",
      progresso: 10,
      mensagemStatus: "Envio imediato autorizado",
    })
    .where(eq(impressoesTable.id, parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

router.patch("/impressoes/:id/status", async (req, res) => {
  const { status, progresso, mensagemStatus } = req.body;
  const up: any = { lido: true };
  if (status) up.status = status;
  if (progresso !== undefined) up.progresso = progresso;
  if (mensagemStatus !== undefined) up.mensagemStatus = mensagemStatus;
  if (status === "Impresso") {
    up.imprimiuEm = new Date();
    up.progresso = 100;
  }
  await db.update(impressoesTable).set(up).where(eq(impressoesTable.id, parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

router.post("/impressoes/heartbeat", async (req, res) => {
  try {
    const {
      ricohOnline,
      epsonOnline,
      ricohStatus,
      epsonStatus,
      ricohIp,
      epsonIp,
      ricohPingMs,
      epsonPingMs,
    } = req.body;
    const agora = new Date().toISOString();
    const nowDate = new Date();

    const ricohStFinal = ricohStatus || (ricohOnline ? "online" : "offline");
    const epsonStFinal = epsonStatus || (epsonOnline ? "online" : "offline");

    const upserts: { chave: string; valor: string }[] = [
      { chave: "last_heartbeat_impressora", valor: agora },
      { chave: "ricoh_status", valor: ricohStFinal },
      { chave: "epson_status", valor: epsonStFinal },
    ];

    if (ricohOnline) upserts.push({ chave: "last_heartbeat_ricoh", valor: agora });
    if (epsonOnline) upserts.push({ chave: "last_heartbeat_epson", valor: agora });
    if (ricohIp !== undefined) upserts.push({ chave: "ricoh_ip_detectado", valor: String(ricohIp || "") });
    if (epsonIp !== undefined) upserts.push({ chave: "epson_ip_detectado", valor: String(epsonIp || "") });
    if (ricohPingMs !== undefined) upserts.push({ chave: "ricoh_ping_ms", valor: String(ricohPingMs ?? "") });
    if (epsonPingMs !== undefined) upserts.push({ chave: "epson_ping_ms", valor: String(epsonPingMs ?? "") });

    for (const item of upserts) {
      await db
        .insert(configuracoesTable)
        .values({ chave: item.chave, valor: item.valor, atualizadoEm: nowDate })
        .onConflictDoUpdate({
          target: configuracoesTable.chave,
          set: { valor: item.valor, atualizadoEm: nowDate },
        });
    }

    const ricohLabel = ricohStFinal !== "offline" ? `LIGADA (${ricohPingMs ? ricohPingMs + "ms" : "OK"})` : "DESLIGADA";
    const epsonLabel = epsonStFinal !== "offline" ? `LIGADA (${epsonPingMs ? epsonPingMs + "ms" : "OK"})` : "DESLIGADA";
    const time = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const line = `[${time}] RICOH: ${ricohLabel}${ricohIp ? ` [${ricohIp}]` : ""} | EPSON: ${epsonLabel}${epsonIp ? ` [${epsonIp}]` : ""}`;

    try {
      const resLog = await db
        .select()
        .from(configuracoesTable)
        .where(eq(configuracoesTable.chave, "impressoras_pings_log"))
        .limit(1);
      let logs: string[] = [];
      if (resLog.length > 0) {
        try {
          logs = JSON.parse(resLog[0].valor);
        } catch {}
      }
      if (!Array.isArray(logs)) logs = [];
      logs.push(line);
      if (logs.length > 60) logs = logs.slice(-60);
      await db
        .insert(configuracoesTable)
        .values({ chave: "impressoras_pings_log", valor: JSON.stringify(logs), atualizadoEm: nowDate })
        .onConflictDoUpdate({
          target: configuracoesTable.chave,
          set: { valor: JSON.stringify(logs), atualizadoEm: nowDate },
        });
    } catch (e) {
      console.error("Erro ao salvar logs de pings:", e);
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("Erro no heartbeat:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/impressoes/status-agente", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    const keys = [
      "last_heartbeat_impressora",
      "ricoh_status",
      "epson_status",
      "ricoh_ip_detectado",
      "epson_ip_detectado",
      "ricoh_ping_ms",
      "epson_ping_ms",
      "impressora_ricoh_ip",
      "impressora_epson_ip",
    ];
    const rows = await db.select().from(configuracoesTable).where(inArray(configuracoesTable.chave, keys));
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.chave] = r.valor || "";
    }

    const agora = Date.now();
    const lastHb = map.last_heartbeat_impressora ? new Date(map.last_heartbeat_impressora).getTime() : 0;
    const secondsAgo = lastHb ? Math.max(0, Math.round((agora - lastHb) / 1000)) : 9999;
    const isAgenteOnline = lastHb > 0 && agora - lastHb < 14000;

    const ricohSt = map.ricoh_status || "offline";
    const epsonSt = map.epson_status || "offline";

    const ricohOnline = isAgenteOnline && ricohSt !== "offline";
    const epsonOnline = isAgenteOnline && epsonSt !== "offline";

    res.json({
      online: isAgenteOnline,
      lastHeartbeat: map.last_heartbeat_impressora || null,
      secondsAgo,
      ricohOnline,
      epsonOnline,
      ricohStatus: isAgenteOnline ? ricohSt : "offline",
      epsonStatus: isAgenteOnline ? epsonSt : "offline",
      ricohIp: map.ricoh_ip_detectado || map.impressora_ricoh_ip || "192.168.18.17",
      epsonIp: map.epson_ip_detectado || map.impressora_epson_ip || "192.168.18.162",
      ricohPingMs: map.ricoh_ping_ms ? Number(map.ricoh_ping_ms) : null,
      epsonPingMs: map.epson_ping_ms ? Number(map.epson_ping_ms) : null,
    });
  } catch {
    res.json({
      online: false,
      ricohOnline: false,
      epsonOnline: false,
      ricohStatus: "offline",
      epsonStatus: "offline",
    });
  }
});

router.get("/impressoes/script-impressora", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(gerarPython(getApiBase(req)));
});

router.get("/impressoes/impressora-loop.vbs", (_req, res) => {
  const vbs = `Dim WshShell, pyScript\nSet WshShell = CreateObject("WScript.Shell")\npyScript = WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\\SistemaImpressao\\impressora_escola.py"\nDo\n    WshShell.Run "pythonw " & Chr(34) & pyScript & Chr(34), 0, True\n    WScript.Sleep 2000\nLoop`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="impressora-loop.vbs"');
  res.send(vbs);
});

router.get("/impressoes/iniciar-impressora.bat", (req, res) => {
  const b = getApiBase(req);
  res.setHeader("Content-Type", "application/x-msdos-program");
  res.setHeader("Content-Disposition", 'attachment; filename="iniciar-impressora.bat"');
  res.send(`@echo off
title Robo de Impressao Ultra-Rapido - EM Jose Giro Faisca
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
echo 3. Baixando agente atualizado de: ${b}
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest '${b}/api/impressoes/script-impressora' -OutFile '%SYS_DIR%\\impressora_escola.py'"

echo.
echo 4. Verificando SumatraPDF...
if not exist "%SYS_DIR%\\SumatraPDF.exe" (
  powershell -Command "Invoke-WebRequest 'https://www.sumatrapdfreader.org/dl/rel/3.5.2/SumatraPDF-3.5.2-64.zip' -OutFile '%SYS_DIR%\\sumatra.zip'"
  powershell -Command "Expand-Archive -Path '%SYS_DIR%\\sumatra.zip' -DestinationPath '%SYS_DIR%' -Force"
  del "%SYS_DIR%\\sumatra.zip"
)

echo.
echo 5. Verificando bibliotecas Python...
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
echo     WScript.Sleep 2000 >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"
echo Loop >> "%STARTUP_DIR%\\robo-impressao-escola.vbs"

echo.
echo 7. Iniciando robo em segundo plano...
start "" wscript.exe "%STARTUP_DIR%\\robo-impressao-escola.vbs"

echo.
echo ==================================================
echo   ROBO DE IMPRESSAO ATUALIZADO E ATIVO!
echo   Monitoramento de ping rapido (2s) em execucao.
echo ==================================================
pause`);
});

router.post("/impressoes/acao/limpar-historico", async (_req, res) => {
  try {
    const deleted = await db.delete(impressoesTable).returning({ id: impressoesTable.id });
    res.json({ ok: true, deleted: deleted.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/impressoes/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(impressoesTable).where(eq(impressoesTable.id, id));
  res.json({ ok: true });
});

function getApiBase(req: any) {
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}`;
  }
  return "https://sistema-jose-giro-escola.vercel.app";
}

function gerarPython(apiBase: string) {
  return `import os, sys, time, tempfile, subprocess, requests, re, socket, glob, threading, json as _json
from concurrent.futures import ThreadPoolExecutor, as_completed

API = "${apiBase}"
LOG_FILE = os.path.join(os.path.expanduser("~"), "SistemaImpressao", "robo_log.txt")
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "RoboImpressaoGiro/3.0"})

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    try:
        print(line, flush=True)
    except:
        pass
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\\n")
    except:
        pass

log("=== ROBO DE IMPRESSAO ULTRA-RAPIDO v3.0 INICIADO ===")
log(f"Conectado ao servidor: {API}")

DEFAULT_RICOH_IPS = ["192.168.18.17", "192.168.2.7"]
DEFAULT_EPSON_IPS = ["192.168.18.162", "192.168.18.122", "192.168.18.90"]

_discovered_cache = {"ts": 0, "ricoh": [], "epson": [], "usb_ricoh": False, "usb_epson": False}

def _extract_ips(text):
    if not text:
        return []
    return [ip for ip in re.findall(r"\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", str(text))
            if not ip.startswith("127.") and not ip.startswith("255.") and not ip.startswith("0.")]

def _as_list(val):
    if not val:
        return []
    return val if isinstance(val, list) else [val]

def discover_local_printer_endpoints():
    now = time.time()
    if now - _discovered_cache["ts"] < 25:
        return _discovered_cache

    ricoh_ips = []
    epson_ips = []
    usb_ricoh = False
    usb_epson = False

    # 1. Hostname DNS/mDNS resolution
    for host, target in [("RNP5838795081A5", ricoh_ips), ("EPSON3974D2", epson_ips), ("EPSON3974D2.local", epson_ips)]:
        try:
            ip = socket.gethostbyname(host)
            if ip and ip not in target:
                target.append(ip)
        except:
            pass

    # 2. ARP table lookup by MAC suffix (Ricoh=50-81-a5, Epson=39-74-d2)
    try:
        arp_out = subprocess.check_output(["arp", "-a"], text=True, creationflags=0x08000000, timeout=2)
        for line in arp_out.splitlines():
            low = line.lower()
            ips = _extract_ips(line)
            if not ips:
                continue
            if "50-81-a5" in low or "58-38-79" in low:
                if ips[0] not in ricoh_ips:
                    ricoh_ips.append(ips[0])
            if "39-74-d2" in low:
                if ips[0] not in epson_ips:
                    epson_ips.append(ips[0])
    except:
        pass

    # 3. Windows Registry WSD & Printer Port IPs + USB active status
    try:
        ps_script = """
        $ports = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\*\\Ports\\*' -ErrorAction SilentlyContinue | Select-Object PSChildName, IPAddress, HostName, PrinterHostAddress
        $wsd = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\SWD\\DAFWSDProvider\\*' -ErrorAction SilentlyContinue | Select-Object FriendlyName, LocationInformation
        $prns = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, PortName, PrinterStatus, WorkOffline
        @{ ports = $ports; wsd = $wsd; prns = $prns } | ConvertTo-Json -Depth 3 -Compress
        """
        out = subprocess.check_output(["powershell", "-NoProfile", "-Command", ps_script],
                                      text=True, creationflags=0x08000000, timeout=4).strip()
        if out:
            data = _json.loads(out)
            for w in _as_list(data.get("wsd")):
                if not isinstance(w, dict): continue
                fn = str(w.get("FriendlyName") or "").upper()
                loc = str(w.get("LocationInformation") or "")
                for ip in _extract_ips(loc):
                    if "EPSON" in fn or "3974D2" in fn or "L3250" in fn:
                        if ip not in epson_ips: epson_ips.append(ip)
                    elif "RICOH" in fn or "3710" in fn or "5081A5" in fn:
                        if ip not in ricoh_ips: ricoh_ips.append(ip)
            for p in _as_list(data.get("ports")):
                if not isinstance(p, dict): continue
                pname = str(p.get("PSChildName") or "").upper()
                raw_ip = f"{p.get('IPAddress','')} {p.get('HostName','')} {p.get('PrinterHostAddress','')}"
                for ip in _extract_ips(raw_ip):
                    if "EP" in pname or "EPSON" in pname or "3974D2" in pname or "L3250" in pname:
                        if ip not in epson_ips: epson_ips.append(ip)
                    elif "RICOH" in pname or "3710" in pname:
                        if ip not in ricoh_ips: ricoh_ips.append(ip)
            for pr in _as_list(data.get("prns")):
                if not isinstance(pr, dict): continue
                name = str(pr.get("Name") or "").upper()
                port = str(pr.get("PortName") or "").upper()
                offline = bool(pr.get("WorkOffline"))
                st = int(pr.get("PrinterStatus") or 0)
                if port.startswith("USB") and not offline and st in (3, 4):
                    if "RICOH" in name or "3710" in name: usb_ricoh = True
                    if "EPSON" in name or "L3250" in name: usb_epson = True
    except:
        pass

    _discovered_cache.update({
        "ts": now,
        "ricoh": ricoh_ips,
        "epson": epson_ips,
        "usb_ricoh": usb_ricoh,
        "usb_epson": usb_epson,
    })
    return _discovered_cache

def _ping_ip(ip, timeout_ms=450):
    t0 = time.perf_counter()
    try:
        out = subprocess.check_output(
            ["ping", "-n", "1", "-w", str(timeout_ms), ip],
            text=True, stderr=subprocess.STDOUT, creationflags=0x08000000, timeout=1.2
        )
        if "TTL=" in out.upper():
            m = re.search(r"(?:tempo|time)[=<]\\s*(\\d+)\\s*ms", out, re.IGNORECASE)
            ms = int(m.group(1)) if m else max(1, int((time.perf_counter() - t0) * 1000))
            return True, ms
    except:
        pass
    return False, None

def _tcp_probe(ip, port, timeout=0.45):
    t0 = time.perf_counter()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        res = s.connect_ex((ip, port))
        s.close()
        if res == 0:
            return True, max(1, int((time.perf_counter() - t0) * 1000))
    except:
        pass
    return False, None

def _probe_single_ip(ip):
    # Executa ping ICMP e portas TCP de impressora em paralelo para resposta imediata (<0.5s)
    with ThreadPoolExecutor(max_workers=5) as ex:
        fut_ping = ex.submit(_ping_ip, ip, 450)
        futs_tcp = [ex.submit(_tcp_probe, ip, p, 0.45) for p in (9100, 515, 631, 80)]
        ok_ping, ms_ping = fut_ping.result()
        if ok_ping:
            return True, ip, ms_ping
        for f in futs_tcp:
            ok_tcp, ms_tcp = f.result()
            if ok_tcp:
                return True, ip, ms_tcp
    return False, ip, None

def check_both_printers_fast(cfg_ricoh_ip, cfg_epson_ip):
    disc = _discovered_cache

    ricoh_candidates = []
    for ip in _extract_ips(cfg_ricoh_ip) + disc["ricoh"] + DEFAULT_RICOH_IPS:
        if ip not in ricoh_candidates:
            ricoh_candidates.append(ip)

    epson_candidates = []
    for ip in _extract_ips(cfg_epson_ip) + disc["epson"] + DEFAULT_EPSON_IPS:
        if ip not in epson_candidates:
            epson_candidates.append(ip)

    def check_candidates(candidates, usb_online, fallback_ip):
        if not candidates:
            return ("online" if usb_online else "offline"), fallback_ip, (1 if usb_online else None)
        with ThreadPoolExecutor(max_workers=max(1, len(candidates))) as ex:
            futures = {ex.submit(_probe_single_ip, ip): ip for ip in candidates}
            for fut in as_completed(futures):
                ok, ip_hit, ms = fut.result()
                if ok:
                    return "online", ip_hit, ms
        if usb_online:
            return "online", "USB", 1
        return "offline", candidates[0], None

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_ricoh = ex.submit(check_candidates, ricoh_candidates, disc["usb_ricoh"], "192.168.18.17")
        f_epson = ex.submit(check_candidates, epson_candidates, disc["usb_epson"], "192.168.18.162")
        return f_ricoh.result(), f_epson.result()

_cached_cfg_ips = {"ts": 0, "ricoh": "", "epson": ""}
def _refresh_cfg_ips():
    try:
        r = requests.get(f"{API}/api/escola/contatos", headers={"User-Agent": "RoboImpressaoGiro/3.0"}, timeout=3.5)
        if r.status_code == 200:
            cfg = r.json()
            _cached_cfg_ips["ricoh"] = cfg.get("impressora_ricoh_ip", "")
            _cached_cfg_ips["epson"] = cfg.get("impressora_epson_ip", "")
            _cached_cfg_ips["ts"] = time.time()
    except Exception as e:
        log(f"Aviso ao buscar IPs: {e}")

def get_ips():
    return _cached_cfg_ips["ricoh"], _cached_cfg_ips["epson"]

def _bg_config_and_discovery():
    while True:
        try:
            _refresh_cfg_ips()
            discover_local_printer_endpoints()
        except:
            pass
        time.sleep(20)

threading.Thread(target=_bg_config_and_discovery, daemon=True).start()

def normalize_external_url(url):
    u = (url or "").strip()
    if not u:
        return u, False
    m_doc = re.search(r"docs\\.google\\.com/document/d/([a-zA-Z0-9_-]+)", u)
    if m_doc:
        return f"https://docs.google.com/document/d/{m_doc.group(1)}/export?format=pdf", True
    m_sheet = re.search(r"docs\\.google\\.com/spreadsheets/d/([a-zA-Z0-9_-]+)", u)
    if m_sheet:
        return f"https://docs.google.com/spreadsheets/d/{m_sheet.group(1)}/export?format=pdf", True
    m_slide = re.search(r"docs\\.google\\.com/presentation/d/([a-zA-Z0-9_-]+)", u)
    if m_slide:
        return f"https://docs.google.com/presentation/d/{m_slide.group(1)}/export/pdf", True
    m_drv = re.search(r"drive\\.google\\.com/(?:file/d/|open\\?id=|uc\\?.*id=)([a-zA-Z0-9_-]+)", u)
    if m_drv:
        return f"https://drive.google.com/uc?export=download&confirm=t&id={m_drv.group(1)}", True
    if "dropbox.com" in u:
        u = re.sub(r"[?&]dl=0$", "", u)
        sep = "&" if "?" in u else "?"
        return f"{u}{sep}dl=1", False
    return u, False

def heart(ricoh_info, epson_info):
    r_st, r_ip, r_ms = ricoh_info
    e_st, e_ip, e_ms = epson_info
    try:
        SESSION.post(f"{API}/api/impressoes/heartbeat", json={
            "ricohOnline": r_st != "offline",
            "epsonOnline": e_st != "offline",
            "ricohStatus": r_st,
            "epsonStatus": e_st,
            "ricohIp": r_ip,
            "epsonIp": e_ip,
            "ricohPingMs": r_ms,
            "epsonPingMs": e_ms,
        }, timeout=4)
    except Exception as e:
        log(f"Falha heartbeat: {e}")

def proc(job):
    jid = job["id"]
    name = job.get("nomeArquivo") or "arquivo"
    try:
        log(f"Processando job #{jid}: {name}")
        SESSION.patch(f"{API}/api/impressoes/{jid}/status",
                      json={"status": "Imprimindo", "progresso": 25, "mensagemStatus": "Baixando arquivo..."},
                      timeout=4)

        url = job.get("linkArquivo", "")
        if not url.startswith("http"):
            url = f"{API}{url}"

        url, forced_pdf = normalize_external_url(url)
        tipo = (job.get("tipoArquivo") or "").lower()
        is_pdf = forced_pdf or "pdf" in tipo or name.lower().endswith(".pdf")
        is_html = not is_pdf and ("html" in tipo or name.lower().endswith(".html") or name.lower().endswith(".htm"))

        r = SESSION.get(url, stream=True, timeout=30)
        r.raise_for_status()
        ctype = (r.headers.get("Content-Type") or "").lower()
        if "pdf" in ctype:
            is_pdf = True
            is_html = False

        ext = ".pdf" if is_pdf else (".html" if is_html else ".png")
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        for c in r.iter_content(8192):
            tf.write(c)
        tf.close()
        print_file = tf.name

        if is_html:
            log("Convertendo HTML para PDF via MS Edge...")
            pdf_path = print_file + ".pdf"
            edge_paths = [
                r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                r"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            ]
            edge_exe = next((p for p in edge_paths if os.path.exists(p)), None)
            if edge_exe:
                subprocess.run([edge_exe, "--headless", "--disable-gpu", f"--print-to-pdf={pdf_path}", print_file],
                               check=True, timeout=30, creationflags=0x08000000)
                os.unlink(print_file)
                print_file = pdf_path
            else:
                raise Exception("MS Edge nao encontrado para converter HTML")
        elif not is_pdf:
            log("Convertendo imagem para PDF...")
            pdf_path = print_file + ".pdf"
            try:
                import img2pdf
                from PIL import Image
                with Image.open(print_file) as img:
                    img.convert("RGB").save(print_file + ".jpg", "JPEG", quality=92)
                with open(print_file + ".jpg", "rb") as f_in, open(pdf_path, "wb") as f_out:
                    f_out.write(img2pdf.convert(f_in))
                os.unlink(print_file + ".jpg")
                os.unlink(print_file)
                print_file = pdf_path
            except Exception as e:
                log(f"Aviso conversao imagem: {e}")

        SESSION.patch(f"{API}/api/impressoes/{jid}/status",
                      json={"status": "Imprimindo", "progresso": 70, "mensagemStatus": "Enviando para a impressora..."},
                      timeout=4)

        target_printer = None
        try:
            printers = [p.strip() for p in subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
                text=True, creationflags=0x08000000, timeout=5
            ).splitlines() if p.strip()]
            pref = (job.get("impressoraNome") or "").strip()
            if pref:
                for p in printers:
                    if pref.upper() in p.upper() and "FAX" not in p.upper():
                        target_printer = p
                        break
            if not target_printer:
                is_color = job.get("colorida")
                if isinstance(is_color, str):
                    is_color = is_color.lower() == "true"
                terms = ["EPSON", "L3250"] if is_color else ["3710", "RICOH"]
                for term in terms:
                    for p in printers:
                        if term in p.upper() and "FAX" not in p.upper():
                            target_printer = p
                            break
                    if target_printer:
                        break
            if not target_printer and printers:
                target_printer = printers[0]
        except Exception as e:
            log(f"Erro ao selecionar impressora: {e}")

        copias = max(1, int(job.get("quantidadeCopias") or 1))
        duplex = job.get("duplex")
        if isinstance(duplex, str):
            duplex = duplex.lower() == "true"
        settings_parts = [f"{copias}x", "duplex" if duplex else "simplex"]
        print_settings = ",".join(settings_parts)

        log(f"Imprimindo em '{target_printer or 'Padrao'}' ({print_settings})...")
        success = False
        sumatra_dir = os.path.join(os.path.expanduser("~"), "SistemaImpressao")
        sumatra = os.path.join(sumatra_dir, "SumatraPDF.exe")
        if not os.path.exists(sumatra):
            matches = glob.glob(os.path.join(sumatra_dir, "SumatraPDF*.exe"))
            if matches:
                sumatra = matches[0]

        if os.path.exists(sumatra):
            try:
                cmd = [sumatra, "-print-to", target_printer, "-print-settings", print_settings, "-silent", print_file] if target_printer else [sumatra, "-print-default", "-print-settings", print_settings, "-silent", print_file]
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=40, creationflags=0x08000000)
                if res.returncode == 0:
                    success = True
                    log("SumatraPDF concluiu o envio.")
            except Exception as e:
                log(f"Erro SumatraPDF: {e}")

        if not success:
            log("Usando fallback PowerShell...")
            p_arg = f'"{target_printer}"' if target_printer else ""
            ps_cmd = f"Start-Process -FilePath '{print_file}' -Verb PrintTo -ArgumentList '{p_arg}' -WindowStyle Hidden -Wait" if target_printer else f"Start-Process -FilePath '{print_file}' -Verb Print -WindowStyle Hidden -Wait"
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], timeout=60, check=True, creationflags=0x08000000)

        SESSION.patch(f"{API}/api/impressoes/{jid}/status",
                      json={"status": "Impresso", "progresso": 100, "mensagemStatus": "Impresso com sucesso!"},
                      timeout=4)
        try:
            if os.path.exists(print_file):
                os.unlink(print_file)
        except:
            pass
        log(f"Job #{jid} finalizado com sucesso!")
    except Exception as e:
        log(f"Falha no job #{jid}: {e}")
        try:
            SESSION.patch(f"{API}/api/impressoes/{jid}/status",
                          json={"status": "Pendente", "progresso": 0, "mensagemStatus": f"Aguardando impressora ({str(e)[:40]})"},
                          timeout=4)
        except:
            pass

# ──────────────────────────────────────
# Loop principal ultra-rápido (ciclo ~2s)
# ──────────────────────────────────────
last_log_state = None
notified_waiting_jobs = set()

while True:
    try:
        ricoh_cfg_ip, epson_cfg_ip = get_ips()
        ricoh_info, epson_info = check_both_printers_fast(ricoh_cfg_ip, epson_cfg_ip)
        r_st, r_ip, r_ms = ricoh_info
        e_st, e_ip, e_ms = epson_info

        cur_state = (r_st, r_ip, e_st, e_ip)
        if cur_state != last_log_state:
            log(f"Status Impressoras -> RICOH={r_st.upper()} ({r_ip}, {r_ms or '-'}ms) | EPSON={e_st.upper()} ({e_ip}, {e_ms or '-'}ms)")
            last_log_state = cur_state

        heart(ricoh_info, epson_info)

        try:
            r = SESSION.get(f"{API}/api/impressoes/pendentes", timeout=5)
            if r.status_code == 200:
                jobs = r.json()
                for j in jobs:
                    jid = j.get("id")
                    is_color = j.get("colorida")
                    if isinstance(is_color, str):
                        is_color = is_color.lower() == "true"
                    pref = (j.get("impressoraNome") or "").upper()
                    wants_epson = ("EPSON" in pref) or (not pref and bool(is_color))
                    printer_ready = (e_st != "offline") if wants_epson else (r_st != "offline")
                    forced_now = (j.get("progresso") == 10)

                    if printer_ready or forced_now:
                        notified_waiting_jobs.discard(jid)
                        proc(j)
                    elif jid not in notified_waiting_jobs:
                        notified_waiting_jobs.add(jid)
                        pname = "Epson L3250" if wants_epson else "Ricoh SP 3710SF"
                        try:
                            SESSION.patch(
                                f"{API}/api/impressoes/{jid}/status",
                                json={
                                    "status": "Pendente",
                                    "progresso": 5,
                                    "mensagemStatus": f"Na fila — aguardando {pname} ser ligada...",
                                },
                                timeout=3,
                            )
                        except:
                            pass
        except Exception as e:
            log(f"Erro ao consultar fila: {e}")
    except Exception as loop_err:
        log(f"Erro no ciclo principal: {loop_err}")

    time.sleep(2)
`;
}

router.get("/impressoes/pings-log", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const row = await db
      .select()
      .from(configuracoesTable)
      .where(eq(configuracoesTable.chave, "impressoras_pings_log"))
      .limit(1);
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

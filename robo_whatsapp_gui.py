import os
import sys
import time
import json
import base64
import subprocess
import datetime
import tempfile
import ctypes
import psycopg2
import pyperclip
import pyautogui
import pygetwindow as gw
from dotenv import load_dotenv

# ─── Win32 para controle de janela (modo fantasma) ───────────────────────────
try:
    import win32gui
    import win32con
    WIN32_DISPONIVEL = True
except ImportError:
    WIN32_DISPONIVEL = False

# ─── PIL para análise de screenshot (detectar "Reconectar") ──────────────────
try:
    from PIL import Image
    PIL_DISPONIVEL = True
except ImportError:
    PIL_DISPONIVEL = False

# Configura fail-safe para abortar caso o mouse vá para o canto da tela
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

# Carrega configurações do .env
script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, ".env")
load_dotenv(dotenv_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("ERRO: DATABASE_URL não foi encontrado no arquivo .env!")
    sys.exit(1)

# Diretório temporário simples (sem espaços e caracteres especiais)
TEMP_DIR = os.path.join(tempfile.gettempdir(), "wa_bot_temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# ─── Configuração do Modo Fantasma ───────────────────────────────────────────
# Quando True, move a janela do WhatsApp para fora da tela durante o envio.
# Isso permite que o usuário continue usando o computador normalmente.
# Ative apenas quando o envio estiver completamente estável.
# O modo é lido da tabela configuracoes (chave: 'whatsapp_fantasma_mode')
MODO_FANTASMA_PADRAO = False   # padrão seguro (desligado)

def get_db_connection():
    return psycopg2.connect(db_url)

def append_log(conn, msg):
    time_str = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[GUI-Bot] [{time_str}] {msg}"
    print(line)
    try:
        cur = conn.cursor()
        cur.execute("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_logs';")
        row = cur.fetchone()
        logs = []
        if row and row[0]:
            try:
                logs = json.loads(row[0])
            except Exception:
                pass
        
        logs.append(line)
        if len(logs) > 200:
            logs = logs[-200:]
            
        cur.execute("""
            INSERT INTO configuracoes (chave, valor, atualizado_em)
            VALUES ('whatsapp_logs', %s, NOW())
            ON CONFLICT (chave)
            DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW();
        """, (json.dumps(logs),))
        conn.commit()
        cur.close()
    except Exception as e:
        print(f"Erro ao salvar logs no banco: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# MODO FANTASMA: Move a janela do WhatsApp para fora da tela visível.
# O aplicativo continua ativo e recebe cliques/teclas normalmente,
# mas não aparece para o usuário. Após o envio, restaura a posição.
# ─────────────────────────────────────────────────────────────────────────────

def _get_wa_hwnd():
    """Retorna o HWND (handle) da janela do WhatsApp, ou None."""
    if not WIN32_DISPONIVEL:
        return None
    result = []
    def _enum(hwnd, _):
        title = win32gui.GetWindowText(hwnd)
        if "whatsapp" in title.lower() and win32gui.IsWindowVisible(hwnd):
            result.append(hwnd)
    win32gui.EnumWindows(_enum, None)
    return result[0] if result else None

def mover_janela_para_fora(conn):
    """
    Move a janela do WhatsApp para fora da área visível da tela.
    Retorna a posição original (x, y, w, h) para restaurar depois.
    """
    if not WIN32_DISPONIVEL:
        append_log(conn, "[Fantasma] win32gui não disponível — modo fantasma desativado.")
        return None
    
    hwnd = _get_wa_hwnd()
    if not hwnd:
        return None
    
    try:
        # Salva posição e tamanho atuais
        rect = win32gui.GetWindowRect(hwnd)
        orig_x, orig_y, orig_r, orig_b = rect
        orig_w = orig_r - orig_x
        orig_h = orig_b - orig_y
        
        # Obtém resolução da tela para mandar para além da borda
        screen_w = win32gui.GetSystemMetrics(0)
        
        # Move para além da borda direita da tela (invisível ao usuário)
        destino_x = screen_w + 100
        win32gui.MoveWindow(hwnd, destino_x, 0, orig_w, orig_h, True)
        append_log(conn, f"[Fantasma] Janela do WhatsApp movida para fora da tela (x={destino_x}).")
        
        return (orig_x, orig_y, orig_w, orig_h)
    except Exception as e:
        append_log(conn, f"[Fantasma] Erro ao mover janela: {e}")
        return None

def restaurar_janela(conn, posicao_original):
    """Restaura a janela do WhatsApp para a posição original."""
    if not WIN32_DISPONIVEL or posicao_original is None:
        return
    
    hwnd = _get_wa_hwnd()
    if not hwnd:
        return
    
    try:
        orig_x, orig_y, orig_w, orig_h = posicao_original
        win32gui.MoveWindow(hwnd, orig_x, orig_y, orig_w, orig_h, True)
        append_log(conn, f"[Fantasma] Janela restaurada para posição original (x={orig_x}, y={orig_y}).")
    except Exception as e:
        append_log(conn, f"[Fantasma] Erro ao restaurar janela: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# VERIFICAÇÃO DE RECONEXÃO
# Detecta se o WhatsApp Desktop exibe o botão/link "Reconectar" e clica nele.
# Isso acontece quando o app fica inativo por muito tempo sem uso.
# ─────────────────────────────────────────────────────────────────────────────

def verificar_e_reconectar(conn):
    """
    Verifica se a tela do WhatsApp mostra a palavra 'Reconectar'.
    Método: screenshot da janela + análise de cor dos pixels.
    
    O botão "Reconectar" no WhatsApp Desktop aparece como um link 
    verde (#25D366) ou azul em uma barra de aviso no topo.
    
    Se encontrar, clica nele e aguarda a reconexão (até 10s).
    Retorna True se reconectou, False se já estava conectado.
    """
    w = get_whatsapp_window()
    if not w:
        return False
    
    try:
        append_log(conn, "Verificando se WhatsApp precisa reconectar...")
        
        # Garante que a janela está visível e ativa
        if w.isMinimized:
            w.restore()
            time.sleep(0.5)
        w.activate()
        time.sleep(0.8)
        
        # ── Método 1: Busca via screenshot e análise de pixels ────────────────
        if PIL_DISPONIVEL:
            reconectado = _detectar_reconectar_por_screenshot(conn, w)
            if reconectado:
                return True
        
        # ── Método 2: Fallback — tenta usar Ctrl+R (atalho de refresh) ───────
        # O WhatsApp Desktop não tem atalho de reconexão, então apenas loga
        append_log(conn, "WhatsApp parece estar conectado. Prosseguindo...")
        return False
        
    except Exception as e:
        append_log(conn, f"[Aviso] Erro ao verificar reconexão: {e}")
        return False


def _detectar_reconectar_por_screenshot(conn, wa_window):
    """
    Tira screenshot da área superior do WhatsApp e analisa os pixels
    procurando a cor característica do botão/link 'Reconectar' do WhatsApp.
    
    Estratégia: O WhatsApp Desktop mostra um banner amarelo/laranja
    na parte superior quando está desconectado. Também verifica a cor 
    do texto do link "Reconectar" (verde #25D366).
    
    Se encontrar, clica no centro do banner e aguarda.
    """
    try:
        # Captura apenas a faixa superior da janela (onde fica o aviso)
        margin = 5
        region = (
            wa_window.left + margin,
            wa_window.top + 50,   # Pula a barra de título
            wa_window.width - margin * 2,
            120                    # Altura da faixa de aviso
        )
        
        screenshot = pyautogui.screenshot(region=region)
        img = screenshot.convert("RGB")
        pixels = img.load()
        w_img, h_img = img.size
        
        # ── Paletas de cor a detectar ─────────────────────────────────────────
        # Verde do WhatsApp (link "Reconectar")
        COR_VERDE_WA    = (37, 211, 102)    # #25D366
        COR_VERDE_DARK  = (0, 168, 132)     # #00A884 (modo escuro)
        COR_AZUL_LINK   = (0, 100, 210)     # Link azul
        COR_AVISO_BG    = (255, 203, 0)     # Banner amarelo de aviso
        COR_AVISO_BG2   = (254, 244, 198)   # Banner amarelo claro
        TOLERANCIA = 35
        
        def cor_proxima(p, ref, tol=TOLERANCIA):
            return (abs(p[0]-ref[0]) < tol and 
                    abs(p[1]-ref[1]) < tol and 
                    abs(p[2]-ref[2]) < tol)
        
        pixels_verdes = 0
        pixels_azuis  = 0
        pixels_aviso  = 0
        
        for y in range(h_img):
            for x in range(w_img):
                p = pixels[x, y]
                if cor_proxima(p, COR_VERDE_WA) or cor_proxima(p, COR_VERDE_DARK):
                    pixels_verdes += 1
                if cor_proxima(p, COR_AZUL_LINK):
                    pixels_azuis += 1
                if cor_proxima(p, COR_AVISO_BG) or cor_proxima(p, COR_AVISO_BG2):
                    pixels_aviso += 1
        
        # Se há muitos pixels de aviso na faixa superior → provavelmente desconectado
        total_pixels = w_img * h_img
        pct_aviso = (pixels_aviso / total_pixels) * 100
        
        append_log(conn, f"[Verificação] Pixels de aviso={pixels_aviso} ({pct_aviso:.1f}%), "
                         f"verde={pixels_verdes}, azul={pixels_azuis}")
        
        # Threshold: se mais de 5% dos pixels são da cor de aviso
        desconectado = pct_aviso > 5.0
        
        if desconectado:
            append_log(conn, "[Reconexão] Detectado banner de aviso! Clicando em 'Reconectar'...")
            
            # Clica no centro do banner (onde fica o link/botão Reconectar)
            click_x = wa_window.left + wa_window.width // 2
            click_y = wa_window.top + 80   # Centro vertical do banner
            pyautogui.click(click_x, click_y)
            
            append_log(conn, f"[Reconexão] Clicou em ({click_x}, {click_y}). Aguardando reconexão...")
            time.sleep(5.0)
            
            # Verifica se reconectou (segunda screenshot deve ter menos pixels de aviso)
            screenshot2 = pyautogui.screenshot(region=region)
            img2 = screenshot2.convert("RGB")
            pixels2 = img2.load()
            w2, h2 = img2.size
            pixels_aviso2 = sum(
                1 for y in range(h2) for x in range(w2)
                if cor_proxima(pixels2[x, y], COR_AVISO_BG) or cor_proxima(pixels2[x, y], COR_AVISO_BG2)
            )
            pct_aviso2 = (pixels_aviso2 / (w2 * h2)) * 100
            
            if pct_aviso2 < pct_aviso:
                append_log(conn, f"[Reconexão] Sucesso! Banner diminuiu de {pct_aviso:.1f}% para {pct_aviso2:.1f}%.")
            else:
                append_log(conn, f"[Reconexão] Banner ainda presente ({pct_aviso2:.1f}%). Aguardando mais 5s...")
                time.sleep(5.0)
            
            return True
        
        return False
        
    except Exception as e:
        append_log(conn, f"[Aviso] Erro na detecção por screenshot: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# FOCO E NAVEGAÇÃO
# ─────────────────────────────────────────────────────────────────────────────

def focus_whatsapp():
    """Foca o WhatsApp Desktop ou abre se não estiver aberto."""
    windows = gw.getWindowsWithTitle('WhatsApp')
    for w in windows:
        if "whatsapp" in w.title.lower():
            try:
                if w.isMinimized:
                    w.restore()
                w.activate()
                time.sleep(1.0)
                return True
            except Exception as e:
                print(f"Aviso ao ativar janela: {e}")
                return True

    # Se não encontrou, tenta abrir pelo URI
    subprocess.Popen("start whatsapp:", shell=True)
    time.sleep(3.0)
    
    windows = gw.getWindowsWithTitle('WhatsApp')
    for w in windows:
        if "whatsapp" in w.title.lower():
            try:
                if w.isMinimized:
                    w.restore()
                w.activate()
                time.sleep(1.0)
                return True
            except Exception:
                return True
    return False

def get_whatsapp_window():
    """Retorna a janela do WhatsApp Desktop ou None."""
    windows = gw.getWindowsWithTitle('WhatsApp')
    for w in windows:
        if "whatsapp" in w.title.lower():
            return w
    return None

def focus_message_input(conn):
    """Foca o campo de digitação de mensagem no WhatsApp."""
    w = get_whatsapp_window()
    if w:
        try:
            if w.isMinimized:
                w.restore()
            w.activate()
            time.sleep(0.6)
            x = w.left + int(w.width * 0.60)
            y = w.top + w.height - 55
            append_log(conn, f"Clicando no campo de mensagem em ({x}, {y}) para focar...")
            pyautogui.click(x, y)
            time.sleep(0.5)
            return True
        except Exception as e:
            append_log(conn, f"[Aviso] Erro ao focar campo de mensagem: {e}")
    return False

def open_chat_number(conn, number):
    """Abre chat direto com o número informado."""
    clean = "".join(filter(str.isdigit, number))
    if len(clean) == 10 or len(clean) == 11:
        clean = "55" + clean
    
    append_log(conn, f"Abrindo chat direto com o número: {clean}")
    uri = f"whatsapp://send?phone={clean}"
    subprocess.Popen(["cmd", "/c", f"start {uri}"], shell=True)
    time.sleep(4.0)
    
    if not focus_whatsapp():
        raise Exception("Não foi possível focar/abrir o aplicativo do WhatsApp.")
    
    time.sleep(1.0)
    focus_message_input(conn)

def open_chat_group(conn, group_name):
    """Busca e abre um grupo no WhatsApp pelo nome."""
    append_log(conn, f"Pesquisando grupo: '{group_name}'")
    if not focus_whatsapp():
        raise Exception("Não foi possível focar/abrir o aplicativo do WhatsApp.")
    
    time.sleep(0.8)
    pyautogui.hotkey('ctrl', 'f')
    time.sleep(0.8)
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.press('backspace')
    time.sleep(0.3)
    pyperclip.copy(group_name)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(2.0)
    pyautogui.press('down')
    time.sleep(0.4)
    pyautogui.press('enter')
    time.sleep(2.0)
    focus_message_input(conn)

def send_text_message(conn, text):
    """Envia uma mensagem de texto pura no chat aberto."""
    append_log(conn, "Focando e colando mensagem de texto...")
    focus_message_input(conn)
    time.sleep(0.3)
    pyperclip.copy(text)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(0.5)
    pyautogui.press('enter')
    time.sleep(2.0)

def copy_file_to_clipboard_windows(file_path):
    """
    Copia um arquivo para o clipboard do Windows usando PowerShell com Add-Type.
    Usa barras / em vez de \\ para evitar problemas de escape no script PowerShell.
    """
    file_path_ps = file_path.replace("\\", "/")
    
    ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
$files.Add('{file_path_ps}')
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
Write-Host OK
"""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
        capture_output=True,
        text=True,
        timeout=15
    )
    if result.returncode != 0:
        raise Exception(f"PowerShell clipboard error: {result.stderr.strip()}")
    if "OK" not in result.stdout:
        raise Exception(f"Clipboard não confirmou sucesso. stdout={result.stdout.strip()} stderr={result.stderr.strip()}")

def send_file_message(conn, file_path, caption=None):
    """
    Envia um arquivo (PDF, imagem etc.) via WhatsApp Desktop.
    Cola o arquivo na conversa e depois adiciona a legenda se houver.
    """
    append_log(conn, f"Copiando arquivo para área de transferência: {os.path.basename(file_path)}")
    
    copy_file_to_clipboard_windows(file_path)
    time.sleep(0.8)
    
    append_log(conn, "Colando arquivo no chat (Ctrl+V)...")
    focus_message_input(conn)
    time.sleep(0.4)
    
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(3.0)
    
    if caption:
        append_log(conn, f"Adicionando legenda: '{caption[:50]}...' " if len(caption) > 50 else f"Adicionando legenda: '{caption}'")
        pyperclip.copy(caption)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(0.5)
    
    append_log(conn, "Enviando arquivo (pressionar Enter)...")
    pyautogui.press('enter')
    time.sleep(5.0)
    
    append_log(conn, f"Arquivo {os.path.basename(file_path)} enviado com sucesso!")

def resolve_group_name(cur, to_jid):
    """Resolve o nome de exibição de um grupo a partir do JID ou palavra-chave."""
    if to_jid == "grupo_da_escola":
        cur.execute("SELECT valor FROM configuracoes WHERE chave = 'escola_whatsapp_grupo';")
        row = cur.fetchone()
        if row and row[0]:
            to_jid = row[0]
        else:
            return "Giró/Recados"
    
    key = f"wa_group_{to_jid}"
    cur.execute("SELECT valor FROM configuracoes WHERE chave = %s;", (key,))
    row = cur.fetchone()
    if row and row[0]:
        return row[0]
    
    return "Giró/Recados"


# ─────────────────────────────────────────────────────────────────────────────
# LOOP PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("============================================================")
    print("INICIANDO ROBO WHATSAPP GUI (AUTOMACAO DE TELA)")
    print("")
    print("RECURSOS ATIVOS:")
    print("  - Verificacao automatica de 'Reconectar' ao iniciar envio")
    print("  - Modo Fantasma (configuravel em: whatsapp_fantasma_mode)")
    print("  - Envio de PDF e mensagem de texto")
    print("")
    print("ATENCAO:")
    print("  O aplicativo do WhatsApp Desktop deve estar aberto.")
    print("============================================================")
    print("")
    
    while True:
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Verifica se o modo GUI está ativo
            cur.execute("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_gui_mode';")
            row_gui = cur.fetchone()
            gui_mode = row_gui and row_gui[0] == "true"
            
            # Verifica se o modo fantasma está ativo
            cur.execute("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_fantasma_mode';")
            row_fantasma = cur.fetchone()
            modo_fantasma = row_fantasma and row_fantasma[0] == "true"
            
            # Busca a mensagem pendente mais antiga
            cur.execute("""
                SELECT id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo 
                FROM fila_whatsapp 
                WHERE status = 'Pendente' 
                ORDER BY criado_em ASC LIMIT 1;
            """)
            row = cur.fetchone()
            
            if row:
                msg_id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo = row
                
                if not gui_mode:
                    append_log(conn, "[Aviso] Modo Baileys detectado, mas robô GUI está processando a fila.")
                
                if modo_fantasma:
                    append_log(conn, "[Fantasma] Modo Fantasma ATIVO — envio silencioso (janela fora da tela).")
                
                append_log(conn, f"Mensagem encontrada na fila (ID: {msg_id}) para {numero}. Iniciando envio...")
                
                # Marca como "Enviando" para evitar dupla execução
                cur.execute(
                    "UPDATE fila_whatsapp SET status = 'Enviando', atualizado_em = NOW() WHERE id = %s;",
                    (msg_id,)
                )
                conn.commit()
                
                posicao_janela_original = None
                
                try:
                    # ── PASSO 1: Abre/foca o WhatsApp ──────────────────────────
                    if not focus_whatsapp():
                        raise Exception("Não foi possível abrir o WhatsApp Desktop.")
                    
                    # ── PASSO 2: Verifica se precisa Reconectar ─────────────────
                    verificar_e_reconectar(conn)
                    
                    # ── PASSO 3: Ativa Modo Fantasma (se configurado) ───────────
                    if modo_fantasma and WIN32_DISPONIVEL:
                        posicao_janela_original = mover_janela_para_fora(conn)
                    
                    # ── PASSO 4: Abre o chat (grupo ou número) ──────────────────
                    is_group = (numero == "grupo_da_escola" or numero.endswith("@g.us"))
                    
                    if is_group:
                        group_name = resolve_group_name(cur, numero)
                        append_log(conn, f"Destino: Grupo '{group_name}'")
                        open_chat_group(conn, group_name)
                    else:
                        open_chat_number(conn, numero)
                    
                    # ── PASSO 5: Envia o arquivo PDF (se houver) ────────────────
                    if arquivo_base64:
                        safe_name = (nome_arquivo or "documento.pdf")
                        safe_name = safe_name.replace(" ", "_").replace("/", "-")
                        temp_filepath = os.path.join(TEMP_DIR, safe_name)
                        
                        append_log(conn, f"Decodificando e salvando PDF temporário: {temp_filepath}")
                        with open(temp_filepath, "wb") as f:
                            f.write(base64.b64decode(arquivo_base64))
                        
                        append_log(conn, f"PDF salvo ({os.path.getsize(temp_filepath)} bytes). Enviando...")
                        
                        try:
                            caption_text = mensagem.strip() if mensagem and mensagem.strip() else None
                            send_file_message(conn, temp_filepath, caption_text)
                            append_log(conn, f"[OK] Documento '{safe_name}' enviado para {numero}.")
                        finally:
                            try:
                                if os.path.exists(temp_filepath):
                                    os.remove(temp_filepath)
                            except Exception:
                                pass
                    else:
                        # ── Apenas mensagem de texto ────────────────────────────
                        send_text_message(conn, mensagem)
                        append_log(conn, f"[OK] Mensagem de texto enviada para {numero}.")
                    
                    # Atualiza status para Enviado
                    cur.execute(
                        "UPDATE fila_whatsapp SET status = 'Enviado', erro = NULL, atualizado_em = NOW() WHERE id = %s;",
                        (msg_id,)
                    )
                    conn.commit()
                    
                except Exception as ex:
                    err_msg = str(ex)
                    append_log(conn, f"[Erro] Falha ao enviar mensagem (ID: {msg_id}): {err_msg}")
                    cur.execute(
                        "UPDATE fila_whatsapp SET status = 'Erro', erro = %s, atualizado_em = NOW() WHERE id = %s;",
                        (err_msg, msg_id)
                    )
                    conn.commit()
                
                finally:
                    # ── PASSO 6: Restaura a janela (Modo Fantasma) ──────────────
                    if posicao_janela_original is not None:
                        restaurar_janela(conn, posicao_janela_original)
            
            cur.close()
            conn.close()
            
        except Exception as e:
            print(f"Erro no loop principal: {e}")
            if conn:
                try: conn.close()
                except: pass
                
        time.sleep(5)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nRobô WhatsApp GUI encerrado pelo usuário.")

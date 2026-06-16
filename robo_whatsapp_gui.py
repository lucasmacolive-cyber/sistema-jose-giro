import os
import sys
import time
import json
import base64
import subprocess
import datetime
import psycopg2
import pyperclip
import pyautogui
import pygetwindow as gw
from dotenv import load_dotenv

# Configura fail-safe para abortar caso o mouse vá para o canto da tela
pyautogui.FAILSAFE = True

# Carrega configurações do .env
script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, ".env")
load_dotenv(dotenv_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("ERRO: DATABASE_URL não foi encontrado no arquivo .env!")
    sys.exit(1)

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
        if len(logs) > 100:
            logs.pop(0)
            
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

def focus_whatsapp():
    # Tenta abrir o WhatsApp usando o protocolo URI do Windows
    subprocess.Popen("start whatsapp:", shell=True)
    time.sleep(2.0) # Espera carregar
    
    # Tenta obter e focar a janela do WhatsApp Desktop
    windows = gw.getWindowsWithTitle('WhatsApp')
    if windows:
        for w in windows:
            # Garante que pegamos a janela do aplicativo (título exato "WhatsApp")
            if w.title == "WhatsApp":
                try:
                    w.restore()
                    w.activate()
                    time.sleep(1.0)
                    return True
                except Exception as e:
                    print(f"Aviso ao ativar janela: {e}")
                    # Continua tentando mesmo se levantar alguma restrição
                    return True
    return False

def open_chat_number(conn, number):
    # Formata número para conversa direta
    clean = "".join(filter(str.isdigit, number))
    if len(clean) == 10 or len(clean) == 11:
        clean = "55" + clean
        
    append_log(conn, f"Abrindo chat direto com o número: {clean}")
    cmd = f"start whatsapp://send?phone={clean}"
    subprocess.run(["cmd", "/c", cmd], check=True)
    time.sleep(3.5) # Tempo estendido para carregar o chat diretamente

def open_chat_group(conn, group_name):
    append_log(conn, f"Pesquisando grupo: '{group_name}'")
    if not focus_whatsapp():
        raise Exception("Não foi possível focar/abrir o aplicativo do WhatsApp.")
        
    # Atalho para ir ao campo de busca
    pyautogui.hotkey('ctrl', 'f')
    time.sleep(0.5)
    
    # Limpa campo de busca
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.press('backspace')
    time.sleep(0.3)
    
    # Digita o nome do grupo usando o clipboard para evitar problemas de layout
    pyperclip.copy(group_name)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(1.5) # Aguarda busca filtrar
    
    # Pressiona para baixo e abre o chat
    pyautogui.press('down')
    time.sleep(0.3)
    pyautogui.press('enter')
    time.sleep(1.5) # Aguarda carregar a conversa

def send_text_message(conn, text):
    append_log(conn, "Pasting and sending text message...")
    pyperclip.copy(text)
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(0.5)
    pyautogui.press('enter')
    time.sleep(1.5) # Espera confirmação de envio visual

def send_file_message(conn, file_path, caption=None):
    append_log(conn, f"Copiando arquivo para área de transferência: {os.path.basename(file_path)}")
    # Comando powershell seguro sem shell=True
    subprocess.run(["powershell", "-Command", "Set-Clipboard", "-LiteralPath", file_path], check=True)
    time.sleep(0.5)
    
    append_log(conn, "Colando arquivo no chat...")
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(2.5) # Espera abrir a tela de visualização de mídia
    
    if caption:
        append_log(conn, "Inserindo legenda do arquivo...")
        pyperclip.copy(caption)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(0.5)
        
    append_log(conn, "Enviando arquivo...")
    pyautogui.press('enter')
    time.sleep(4.0) # Espera o upload e processamento do arquivo

def resolve_group_name(cur, to_jid):
    # Se for a palavra-chave grupo_da_escola, busca o JID configurado
    if to_jid == "grupo_da_escola":
        cur.execute("SELECT valor FROM configuracoes WHERE chave = 'escola_whatsapp_grupo';")
        row = cur.fetchone()
        if row and row[0]:
            to_jid = row[0]
        else:
            return None
            
    # Busca o nome correspondente ao JID na tabela configuracoes
    key = f"wa_group_{to_jid}"
    cur.execute("SELECT valor FROM configuracoes WHERE chave = %s;", (key,))
    row = cur.fetchone()
    if row and row[0]:
        return row[0]
    return None

def main():
    print("============================================================")
    print("ROBÔ DE WHATSAPP GUI (AUTOMAÇÃO DE TELA) INICIADO")
    print("============================================================")
    
    # Cria pasta temporária
    temp_dir = os.path.join(script_dir, "temp_whatsapp_gui")
    os.makedirs(temp_dir, exist_ok=True)
    
    while True:
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Verifica se o modo GUI está ativo nas configurações do sistema
            cur.execute("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_gui_mode';")
            row_gui = cur.fetchone()
            gui_mode = row_gui and row_gui[0] == "true"
            
            # Buscamos a mensagem pendente mais antiga
            cur.execute("""
                SELECT id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo 
                FROM fila_whatsapp 
                WHERE status = 'Pendente' 
                ORDER BY criado_em ASC LIMIT 1;
            """)
            row = cur.fetchone()
            
            if row:
                msg_id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo = row
                
                # Se não estiver no modo GUI, avisa e espera (mas processa se o usuário explicitamente iniciou o robô GUI)
                if not gui_mode:
                    append_log(conn, "[Aviso] O sistema está configurado para Modo Baileys, mas o robô GUI está processando a fila.")
                
                append_log(conn, f"Mensagem encontrada na fila (ID: {msg_id}) para {numero}. Iniciando envio...")
                
                # Marca como enviando para evitar dupla execução
                cur.execute("UPDATE fila_whatsapp SET status = 'Enviando', atualizado_em = NOW() WHERE id = %s;", (msg_id,))
                conn.commit()
                
                try:
                    # Decide se é grupo ou número
                    is_group = False
                    target = numero
                    
                    if numero == "grupo_da_escola" or numero.endswith("@g.us"):
                        is_group = True
                        group_name = resolve_group_name(cur, numero)
                        if group_name:
                            target = group_name
                        else:
                            # Se não encontrou o nome do grupo nas configurações, usa o próprio JID/termo
                            append_log(conn, f"[Aviso] Nome do grupo para {numero} não encontrado. Buscando pelo termo bruto.")
                            target = numero
                    
                    # Abre a conversa adequada
                    if is_group:
                        open_chat_group(conn, target)
                    else:
                        open_chat_number(conn, target)
                        
                    # Processa anexo se houver
                    if arquivo_base64:
                        temp_filename = nome_arquivo if nome_arquivo else "documento.pdf"
                        temp_filepath = os.path.join(temp_dir, temp_filename)
                        
                        # Decodifica base64 e grava arquivo local
                        with open(temp_filepath, "wb") as f:
                            f.write(base64.b64decode(arquivo_base64))
                            
                        try:
                            send_file_message(conn, temp_filepath, mensagem)
                            append_log(conn, f"Sucesso: Documento {temp_filename} enviado para {numero}.")
                        finally:
                            # Remove arquivo temporário
                            if os.path.exists(temp_filepath):
                                os.remove(temp_filepath)
                    else:
                        # Envia apenas mensagem de texto
                        send_text_message(conn, mensagem)
                        append_log(conn, f"Sucesso: Mensagem de texto enviada para {numero}.")
                    
                    # Atualiza status para Enviado
                    cur.execute("UPDATE fila_whatsapp SET status = 'Enviado', erro = NULL, atualizado_em = NOW() WHERE id = %s;", (msg_id,))
                    conn.commit()
                    
                except Exception as ex:
                    err_msg = str(ex)
                    append_log(conn, f"[Erro] Falha ao enviar mensagem (ID: {msg_id}): {err_msg}")
                    cur.execute("UPDATE fila_whatsapp SET status = 'Erro', erro = %s, atualizado_em = NOW() WHERE id = %s;", (err_msg, msg_id))
                    conn.commit()
            
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

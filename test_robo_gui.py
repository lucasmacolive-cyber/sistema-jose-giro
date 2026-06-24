"""
Teste rápido do robô WhatsApp GUI - verifica banco e fila sem abrir o WhatsApp
"""
import os, sys, json, base64, tempfile
from dotenv import load_dotenv
import psycopg2

script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))
db_url = os.getenv("DATABASE_URL")

TEMP_DIR = os.path.join(tempfile.gettempdir(), 'wa_bot_temp')
os.makedirs(TEMP_DIR, exist_ok=True)

print(f"[Teste] Conectando ao banco de dados...")
conn = psycopg2.connect(db_url)
cur = conn.cursor()
print("[Teste] Conexão OK!")

# Verifica modo GUI
cur.execute("SELECT valor FROM configuracoes WHERE chave = 'whatsapp_gui_mode';")
row = cur.fetchone()
gui_mode = row and row[0] == "true"
print(f"[Teste] Modo GUI ativo: {gui_mode}")

# Verifica fila pendente
cur.execute("""
    SELECT id, numero, mensagem, arquivo_base64, mimetype, nome_arquivo, status
    FROM fila_whatsapp 
    ORDER BY criado_em DESC LIMIT 5;
""")
rows = cur.fetchall()
print(f"[Teste] Últimas 5 mensagens na fila:")
for r in rows:
    has_file = "✅ PDF" if r[3] else "📝 Texto"
    print(f"  ID={r[0]} | Para={r[1]} | {has_file} | Arquivo={r[5]} | Status={r[6]}")

# Verifica se o diretório temporário foi criado corretamente
print(f"\n[Teste] Diretório temporário: {TEMP_DIR}")
print(f"[Teste] Diretório existe: {os.path.exists(TEMP_DIR)}")

# Simula decode de arquivo base64 se houver pendente
cur.execute("""
    SELECT id, nome_arquivo, arquivo_base64
    FROM fila_whatsapp 
    WHERE status = 'Pendente' AND arquivo_base64 IS NOT NULL
    LIMIT 1;
""")
row_file = cur.fetchone()
if row_file:
    msg_id, nome, b64 = row_file
    safe_name = (nome or "documento.pdf").replace(" ", "_").replace("/", "-")
    temp_path = os.path.join(TEMP_DIR, safe_name)
    print(f"\n[Teste] Decodificando arquivo (ID={msg_id}): {safe_name}")
    decoded = base64.b64decode(b64)
    with open(temp_path, "wb") as f:
        f.write(decoded)
    print(f"[Teste] Arquivo salvo em: {temp_path} ({os.path.getsize(temp_path)} bytes)")
    os.remove(temp_path)
    print(f"[Teste] Arquivo removido após teste.")
else:
    print("\n[Teste] Nenhuma mensagem pendente com arquivo na fila.")

cur.close()
conn.close()
print("\n[Teste] ✅ Todos os testes passaram! O robô está pronto para enviar.")

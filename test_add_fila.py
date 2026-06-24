"""
Ativa o Modo GUI e adiciona mensagem de teste na fila do WhatsApp.
"""
import os
from dotenv import load_dotenv
import psycopg2

script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))
db_url = os.getenv("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Ativa modo GUI
cur.execute("""
    INSERT INTO configuracoes (chave, valor, atualizado_em)
    VALUES ('whatsapp_gui_mode', 'true', NOW())
    ON CONFLICT (chave)
    DO UPDATE SET valor = 'true', atualizado_em = NOW();
""")

# Adiciona mensagem de teste para o numero pessoal
cur.execute("""
    INSERT INTO fila_whatsapp (numero, mensagem, status, criado_em, atualizado_em)
    VALUES ('22992189033', 'Teste do Robo WhatsApp GUI! Este envio foi feito pelo robo de automacao de tela da Escola Municipal Jose Giro Faisca. Se voce recebeu esta mensagem, o sistema esta funcionando!', 'Pendente', NOW(), NOW())
    RETURNING id;
""")
row = cur.fetchone()
conn.commit()

print(f"[OK] Modo GUI ativado!")
print(f"[OK] Mensagem de teste adicionada na fila (ID: {row[0]})")
print(f"[OK] Destino: 22992189033 (numero pessoal)")
print(f"")
print(f"Agora execute: python robo_whatsapp_gui.py")
print(f"O robo ira encontrar a mensagem e enviar para o WhatsApp automaticamente.")

cur.close()
conn.close()

import os, sys, time, tempfile, subprocess, requests, img2pdf

API = "https://sistema-jose-giro-api-server.vercel.app"
LOG_FILE = os.path.join(os.path.expanduser("~"), "SistemaImpressao", "robo_log.txt")

def log(msg):
    try:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")
    except:
        pass
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
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

def heart():
    try:
        r = requests.post(f"{API}/api/impressoes/heartbeat", timeout=5)
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
        r = requests.get(f"{API}{job['linkArquivo']}", stream=True)
        
        is_pdf = "pdf" in job.get("tipoArquivo","").lower() or name.lower().endswith(".pdf")
        is_html = "html" in job.get("tipoArquivo","").lower() or name.lower().endswith(".html") or name.lower().endswith(".htm")
        ext = ".pdf" if is_pdf else (".html" if is_html else ".png")
        
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        for c in r.iter_content(8192):
            tf.write(c)
        tf.close()
        
        print_file = tf.name
        
        if is_html:
            log("Convertendo HTML para PDF usando MS Edge...")
            pdf_path = print_file + ".pdf"
            edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
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
    try:
        r = requests.get(f"{API}/api/impressoes/pendentes", timeout=10)
        if r.status_code == 200:
            for j in r.json():
                proc(j)
    except:
        pass
    
    for _ in range(10):
        heart()
        time.sleep(1)

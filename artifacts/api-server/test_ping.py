import subprocess, json, re

def check_printer_online():
    try:
        out = subprocess.check_output([
            "powershell", "-Command", 
            "Get-Printer | Where-Object { $_.Name -match 'RICOH' -or $_.Name -match 'EPSON' } | Select-Object -ExpandProperty PortName | ConvertTo-Json"
        ], text=True).strip()
        if not out: return False
        
        ports = json.loads(out)
        if isinstance(ports, str): ports = [ports]
        
        for port in ports:
            if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", port):
                res = subprocess.call(["ping", "-n", "1", "-w", "1000", port], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if res == 0: return True
            else:
                status = subprocess.check_output([
                    "powershell", "-Command",
                    f"Get-CimInstance Win32_Printer | Where-Object PortName -eq '{port}' | Select-Object -ExpandProperty PrinterStatus"
                ], text=True).strip()
                if "3" in status or "4" in status: return True
        return False
    except Exception as e:
        print(e)
        return False

print("Online?", check_printer_online())

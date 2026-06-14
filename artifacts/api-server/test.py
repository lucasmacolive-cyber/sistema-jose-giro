import subprocess

out = subprocess.check_output([
    "powershell", 
    "-Command", 
    "Get-Printer | Select-Object Name, PortName | ConvertTo-Json"
], text=True)
print(out)

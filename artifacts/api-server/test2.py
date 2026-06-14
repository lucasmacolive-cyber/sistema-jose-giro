import subprocess
try:
    out = subprocess.check_output([
        "powershell", 
        "-Command", 
        "Get-CimInstance Win32_Printer | Where-Object { ($_.Name -match 'RICOH' -or $_.Name -match 'EPSON') -and $_.PrinterStatus -eq 3 } | Select-Object Name | Measure-Object | Select-Object -ExpandProperty Count"
    ], text=True).strip()
    print("COUNT:", out)
except Exception as e:
    print("ERROR:", e)

import subprocess, os, tempfile

# Cria arquivo de teste no temp simples
temp_dir = os.path.join(tempfile.gettempdir(), 'wa_bot_temp')
os.makedirs(temp_dir, exist_ok=True)
test_file = os.path.join(temp_dir, 'teste.txt')
with open(test_file, 'w') as f:
    f.write('Arquivo de teste para clipboard')

# Usa barras simples (PowerShell aceita ambas)
path_ps = test_file.replace('\\', '/')

ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
$files.Add('{path_ps}')
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
Write-Host OK
"""

r = subprocess.run(
    ['powershell', '-NoProfile', '-NonInteractive', '-Command', ps_script],
    capture_output=True, text=True, timeout=15
)
print('STDOUT:', r.stdout.strip())
print('STDERR:', r.stderr.strip())
print('RC:', r.returncode)
print('Arquivo temporário:', test_file)
print('Arquivo existe:', os.path.exists(test_file))

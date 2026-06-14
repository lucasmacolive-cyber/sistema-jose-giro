taskkill /f /im pythonw.exe >nul 2>&1
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://sistema-jose-giro-escola.vercel.app/api/impressoes/script-impressora?v=20' -OutFile 'C:\Users\kjvtr\SistemaImpressao\impressora_escola.py'"
start "" wscript.exe "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\robo-impressao-escola.vbs"

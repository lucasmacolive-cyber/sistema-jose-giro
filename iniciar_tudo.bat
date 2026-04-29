@echo off
:: Navega para o diretório onde o script está localizado
cd /d "%~dp0"

echo Iniciando o Servidor API...
start /b cmd /c "pnpm --filter @workspace/api-server dev"

echo Iniciando o Frontend...
start /b cmd /c "pnpm --filter @workspace/escola dev"

echo.
echo Sistema iniciado em segundo plano!
exit

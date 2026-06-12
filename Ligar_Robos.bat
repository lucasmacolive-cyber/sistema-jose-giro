@echo off
title Robos Escolares - WhatsApp e SUAP
echo ==============================================
echo Iniciando Robos: WhatsApp e SUAP Sync...
echo ==============================================
cd /d "%~dp0"
start "Robo WhatsApp" cmd /c "node robo_whatsapp.js"
start "Robo SUAP" cmd /c "node robo_suap.js"
echo Robos iniciados em novas janelas!
exit

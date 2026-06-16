@echo off
title Robo WhatsApp GUI - Sistema Jose Giro
cd /d "%~dp0"
echo ============================================================
echo INICIANDO ROBO WHATSAPP GUI (AUTOMACAO DE TELA)
echo.
echo ATENCAO:
echo 1. O aplicativo do WhatsApp Desktop deve estar aberto.
echo 2. Nao mexa no teclado ou mouse enquanto o robo envia
echo    as mensagens, para nao interromper a automacao.
echo ============================================================
echo.
python robo_whatsapp_gui.py
pause

@echo off
chcp 65001 > nul
echo.
echo 🔍 MONITORANDO WEBHOOKS EM TEMPO REAL
echo ========================================================
echo.
echo Aguardando webhooks...
echo Pressione Ctrl+C para parar
echo.

:loop
plink.exe -batch -ssh root@72.60.141.244 -pw Tg74108520963, -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "tail -n 1 /var/log/nginx/access.log | grep -i 'POST.*webhook'"
timeout /t 2 /nobreak >nul
goto loop













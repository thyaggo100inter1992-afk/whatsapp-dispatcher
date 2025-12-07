@echo off
echo ===========================================
echo DEPLOY NO SERVIDOR
echo ===========================================

echo.
echo [1/4] Fazendo git pull...
"%USERPROFILE%\plink.exe" -ssh root@72.60.141.244 -pw Tg74108520963, -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "cd /root/whatsapp-dispatcher && git pull"

echo.
echo [2/4] Fazendo build do frontend...
"%USERPROFILE%\plink.exe" -ssh root@72.60.141.244 -pw Tg74108520963, -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "cd /root/whatsapp-dispatcher/frontend && npm run build"

echo.
echo [3/4] Reiniciando PM2...
"%USERPROFILE%\plink.exe" -ssh root@72.60.141.244 -pw Tg74108520963, -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "pm2 restart frontend"

echo.
echo [4/4] Verificando status...
"%USERPROFILE%\plink.exe" -ssh root@72.60.141.244 -pw Tg74108520963, -hostkey "ssh-ed25519 255 SHA256:mwH4j3imJiJAwSaKb1IxslHWE8OCPyzy8VOWB6qnWsM" "pm2 status"

echo.
echo ===========================================
echo DEPLOY CONCLUIDO! Atualize a pagina (F5)
echo ===========================================
pause


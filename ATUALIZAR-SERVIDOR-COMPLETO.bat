@echo off
chcp 65001 >nul
echo.
echo ========================================
echo 🚀 ATUALIZAR SERVIDOR COMPLETO
echo ========================================
echo.
echo PASSO 1: Conecte-se ao servidor
echo.
echo Execute no PowerShell:
echo    ssh root@72.60.141.244
echo.
echo Senha: Tg74108520963,
echo.
echo ========================================
echo PASSO 2: Após conectar, copie e cole:
echo ========================================
echo.
echo cd /root/whatsapp-dispatcher ^&^& curl -O https://raw.githubusercontent.com/thyaggo100inter1992-afk/whatsapp-dispatcher/main/atualizar-sistema-completo.sh ^&^& chmod +x atualizar-sistema-completo.sh ^&^& ./atualizar-sistema-completo.sh
echo.
echo ========================================
echo.
echo OU execute estes comandos linha por linha:
echo.
echo cd /root/whatsapp-dispatcher
echo git pull origin main
echo cd backend
echo rm -rf dist
echo npm install
echo npm run build
echo cd ../frontend
echo npm install
echo npm run build
echo pm2 restart whatsapp-backend
echo pm2 restart whatsapp-frontend
echo pm2 status
echo.
echo ========================================
echo ✅ Depois de executar, teste em:
echo    https://sistemasnettsistemas.com.br
echo.
echo 💡 Use Ctrl + Shift + R para recarregar
echo ========================================
echo.
pause


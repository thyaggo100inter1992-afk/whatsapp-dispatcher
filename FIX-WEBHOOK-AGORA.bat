@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   🔧 FIX WEBHOOK - RESOLVER AGORA
echo ========================================
echo.
echo Este script vai criar a tabela webhook_logs
echo.
echo IMPORTANTE: Abra o arquivo SQL e execute manualmente!
echo.
echo Siga estes passos:
echo.
echo ┌────────────────────────────────────────┐
echo │  📋 PASSO A PASSO                      │
echo └────────────────────────────────────────┘
echo.
echo 1. Abra o pgAdmin (ou seu cliente SQL)
echo.
echo 2. Conecte ao banco: whatsapp_dispatcher
echo.
echo 3. Abra o arquivo:
echo    APLICAR-WEBHOOK-FIX.sql
echo.
echo 4. Execute o script completo
echo.
echo 5. Reinicie o backend:
echo    - Pressione Ctrl+C no terminal do backend
echo    - Execute: 3-iniciar-backend.bat
echo.
echo 6. Recarregue a página no navegador (F5)
echo.
echo ========================================
echo.
echo 📁 Abrindo o arquivo SQL para você...
echo.

start "" "APLICAR-WEBHOOK-FIX.sql"

echo.
echo ✅ Arquivo aberto!
echo.
echo Depois de executar o SQL, volte aqui e pressione qualquer tecla
echo para reiniciar o backend automaticamente.
echo.
pause

echo.
echo 🔄 Reiniciando backend...
echo.

cd backend
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

start "" cmd /k "npm run dev"

echo.
echo ========================================
echo   ✅ BACKEND REINICIADO!
echo ========================================
echo.
echo Agora:
echo   1. Pressione F5 no navegador
echo   2. Vá para Configurações → Conta → Webhooks
echo.
echo Deve funcionar agora! 🎉
echo.
pause


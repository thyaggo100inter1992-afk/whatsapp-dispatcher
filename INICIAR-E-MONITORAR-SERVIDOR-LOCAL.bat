@echo off
chcp 65001 >nul
echo.
echo ========================================
echo 🚀 INICIANDO SERVIDOR LOCAL
echo ========================================
echo.

cd /d "%~dp0backend"

echo 📋 Verificando configuração...
echo.
findstr /C:"PORT=" .env
findstr /C:"WEBHOOK_VERIFY_TOKEN=" .env
echo.

echo ========================================
echo 🎯 INSTRUÇÕES PARA TESTAR:
echo ========================================
echo.
echo 1. Este terminal vai mostrar os LOGS do servidor
echo 2. Quando aparecer "Server running on port 3001"
echo 3. Faça o teste no Facebook Developers
echo 4. OBSERVE os logs aqui em tempo real
echo.
echo ✅ Se aparecer: "📥 Webhook recebido" = FUNCIONOU!
echo ❌ Se não aparecer nada = Facebook não está enviando
echo.
echo ========================================
echo 🔥 INICIANDO SERVIDOR...
echo ========================================
echo.

npm run dev

pause












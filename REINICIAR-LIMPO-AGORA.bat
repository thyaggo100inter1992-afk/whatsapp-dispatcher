@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🔄 REINICIALIZACAO COMPLETA 🔄                    ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo 🔄 Matando TODOS os processos Node...
taskkill /F /IM node.exe >nul 2>&1

echo ⏳ Aguardando 5 segundos...
timeout /t 5 /nobreak >nul

echo ✅ Processos limpos!
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND (Porta 3000) - .ENV LIMPO
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "✅ BACKEND LIMPO - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando com .env correto...
timeout /t 8 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND (Porta 3001)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "✅ FRONTEND - Porta 3001" cmd /k "npm run dev"

echo ✅ Frontend iniciando...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ REINICIALIZADO COM .ENV CORRETO! ✅            ║
echo ║                                                          ║
echo ║  ⚠️  IMPORTANTE: Todos processos antigos foram mortos    ║
echo ║                                                          ║
echo ║  Aguarde 30 segundos e então:                            ║
echo ║                                                          ║
echo ║  1. Vá para o navegador                                  ║
echo ║  2. Pressione Ctrl + Shift + R (limpar cache)            ║
echo ║  3. Faça login:                                          ║
echo ║                                                          ║
echo ║     📧 Email: admin@minhaempresa.com                     ║
echo ║     🔑 Senha: admin123                                   ║
echo ║                                                          ║
echo ║  🔍 Verifique a janela do BACKEND:                       ║
echo ║     O erro do PostgreSQL DEVE ter sumido!                ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause






@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🔧 REINICIANDO COM .ENV CORRETO 🔧                ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Matar todos os processos Node
echo 🔄 Parando processos anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo ✅ .env.local criado com a configuração correta!
echo.
echo    NEXT_PUBLIC_API_URL=http://localhost:3000/api
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "Backend - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando...
timeout /t 5 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND (Porta 3001 + .env.local)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "Frontend - Porta 3001" cmd /k "npm run dev"

echo ✅ Frontend iniciando com variáveis corretas...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ .ENV.LOCAL CONFIGURADO! ✅                     ║
echo ║                                                          ║
echo ║  API URL: http://localhost:3000/api ✅                   ║
echo ║                                                          ║
echo ║  ⏳ AGUARDE 30 SEGUNDOS para compilação...               ║
echo ║                                                          ║
echo ║  📁 2 janelas CMD foram abertas                          ║
echo ║                                                          ║
echo ║  Quando ver "Ready", acesse:                             ║
echo ║  🌐 http://localhost:3001/login                          ║
echo ║                                                          ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ║  🔍 Verifique o console do navegador                     ║
echo ║     Deve chamar: http://localhost:3000/api/auth/login    ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Pressione qualquer tecla para continuar...
pause >nul






@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🔧 INICIANDO COM PORTAS CORRETAS 🔧                  ║
echo ║                                                          ║
echo ║  🔧 Backend:  Porta 3001                                 ║
echo ║  🌐 Frontend: Porta 3000                                 ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo 🛑 Matando processos Node antigos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  BACKEND - Porta 3001
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"

REM Definir PORT=3001 no ambiente
set PORT=3001

start "BACKEND - Porta 3001" cmd /k "set PORT=3001 && npm run dev"

echo ✅ Backend iniciando na porta 3001...
timeout /t 8 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  FRONTEND - Porta 3000
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "FRONTEND - Porta 3000" cmd /k "npm run dev"

echo ✅ Frontend iniciando na porta 3000...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ SISTEMA INICIADO! ✅                           ║
echo ║                                                          ║
echo ║  Aguarde 30 segundos e verifique as janelas CMD:        ║
echo ║                                                          ║
echo ║  BACKEND deve mostrar:                                   ║
echo ║    🚀 Server running on port 3001                        ║
echo ║                                                          ║
echo ║  FRONTEND deve mostrar:                                  ║
echo ║    ✓ Ready on http://localhost:3000                     ║
echo ║                                                          ║
echo ║  Então acesse:                                           ║
echo ║    http://localhost:3000/login                           ║
echo ║                                                          ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause



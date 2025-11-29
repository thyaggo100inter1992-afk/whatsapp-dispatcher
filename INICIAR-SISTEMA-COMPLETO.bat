@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🚀 INICIANDO SISTEMA COMPLETO 🚀                     ║
echo ║                                                          ║
echo ║  Backend:  Porta 3001                                    ║
echo ║  Frontend: Porta 3000                                    ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo 🛑 Limpando processos Node antigos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND - Porta 3001
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
set PORT=
set PORT=3001
start "BACKEND - Porta 3001" cmd /k "set PORT=3001 && npm run dev"

echo ✅ Backend iniciando...
timeout /t 10 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND - Porta 3000
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "FRONTEND - Porta 3000" cmd /k "npm run dev"

echo ✅ Frontend iniciando...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ SISTEMA INICIADO! ✅                           ║
echo ║                                                          ║
echo ║  Aguarde 30-40 segundos e verifique as janelas CMD:     ║
echo ║                                                          ║
echo ║  BACKEND deve mostrar:                                   ║
echo ║    🚀 Server running on port 3001                        ║
echo ║                                                          ║
echo ║  FRONTEND deve mostrar:                                  ║
echo ║    ✓ Ready on http://localhost:3000                     ║
echo ║                                                          ║
echo ║  Então acesse:                                           ║
echo ║    http://localhost:3000                                 ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

pause





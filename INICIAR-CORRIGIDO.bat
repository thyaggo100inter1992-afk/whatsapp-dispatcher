@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🔧 INICIANDO SISTEMA CORRIGIDO 🔧                 ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Matar TODOS os processos Node
echo 🔄 Limpando processos Node...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  BACKEND - Porta 3000 (CORRIGIDA!)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "✅ Backend - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando na porta 3000...
timeout /t 5 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  FRONTEND - Porta 3001 (Link corrigido!)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "✅ Frontend - Porta 3001" cmd /k "npm run dev"

echo ✅ Frontend iniciando na porta 3001...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ CORREÇÕES APLICADAS! ✅                        ║
echo ║                                                          ║
echo ║  🔧 Backend:  Porta 3000 (corrigida!)                    ║
echo ║  🔧 Frontend: Link corrigido (Next.js 14)                ║
echo ║                                                          ║
echo ║  ⏳ AGUARDE 30 SEGUNDOS para compilação...               ║
echo ║                                                          ║
echo ║  📁 Verifique as 2 janelas CMD abertas:                  ║
echo ║     1. Backend - Porta 3000                              ║
echo ║     2. Frontend - Porta 3001                             ║
echo ║                                                          ║
echo ║  Quando ver "Ready", acesse:                             ║
echo ║  🌐 http://localhost:3001/login                          ║
echo ║                                                          ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Aguarde 30 segundos e depois execute: VERIFICAR-STATUS.bat
echo.
pause






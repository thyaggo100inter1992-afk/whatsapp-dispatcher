@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🚀 INICIANDO SISTEMA COMPLETO 🚀                  ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Matar processos Node antigos
echo 🔄 Limpando processos antigos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  INICIANDO BACKEND (Porta 3000)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "Backend - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando...
timeout /t 3 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  INICIANDO FRONTEND (Porta 3001)
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "Frontend - Porta 3001" cmd /k "npm run dev"

echo ✅ Frontend iniciando...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ SISTEMA INICIADO! ✅                           ║
echo ║                                                          ║
echo ║  ⏳ AGUARDE 20-30 SEGUNDOS para compilação...            ║
echo ║                                                          ║
echo ║  Você verá 2 janelas abertas:                            ║
echo ║  📁 Backend - Porta 3000                                 ║
echo ║  📁 Frontend - Porta 3001                                ║
echo ║                                                          ║
echo ║  Quando ver "Ready" no Frontend, acesse:                 ║
echo ║                                                          ║
echo ║  🌐 http://localhost:3001/login                          ║
echo ║                                                          ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul






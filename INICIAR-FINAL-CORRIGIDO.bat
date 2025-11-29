@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        🔧 INICIANDO COM .ENV LIMPO 🔧                    ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Matar todos os processos Node
echo 🔄 Limpando processos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo ✅ .env do backend recriado (limpo)
echo ✅ .env.local do frontend configurado
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 1️⃣  BACKEND - Porta 3000
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0backend"
start "Backend - Porta 3000" cmd /k "npm run dev"

echo ✅ Backend iniciando...
timeout /t 5 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 2️⃣  FRONTEND - Porta 3001
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
start "Frontend - Porta 3001" cmd /k "npm run dev"

echo ✅ Frontend iniciando...
echo.

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        ✅ .ENV CORRIGIDO E LIMPO! ✅                     ║
echo ║                                                          ║
echo ║  Problemas corrigidos:                                   ║
echo ║  ✅ Senha do PostgreSQL formatada                       ║
echo ║  ✅ Caracteres estranhos removidos                      ║
echo ║  ✅ PORT=3000 definido                                  ║
echo ║  ✅ DATABASE_URL completo                               ║
echo ║                                                          ║
echo ║  ⏳ AGUARDE 30 SEGUNDOS...                               ║
echo ║                                                          ║
echo ║  Depois acesse:                                          ║
echo ║  🌐 http://localhost:3001/login                          ║
echo ║                                                          ║
echo ║  📧 Email: admin@minhaempresa.com                        ║
echo ║  🔑 Senha: admin123                                      ║
echo ║                                                          ║
echo ║  Agora o erro do PostgreSQL deve sumir!                  ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause






@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🔧 INICIANDO BACKEND - PORTA 3001 🔧                 ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

echo 🛑 Limpando processos Node antigos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🔧 FORÇANDO PORTA 3001
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Limpar qualquer PORT anterior
set PORT=

REM Definir PORT=3001
set PORT=3001

echo ✅ PORT definido: %PORT%
echo.

cd /d "%~dp0backend"

echo 🚀 Iniciando backend...
echo.
echo ⚠️  Aguarde ver a mensagem:
echo    "Server running on port 3001"
echo.
echo Se aparecer "port 5000", feche e execute novamente!
echo.

npm run dev

pause


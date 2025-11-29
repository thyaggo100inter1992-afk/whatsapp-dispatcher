@echo off
chcp 65001 >nul
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           REINICIAR BACKEND (Sem recompilar)              ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo ⚠️  Este script reinicia o backend SEM recompilar o TypeScript
echo    Use quando fizer mudanças apenas em arquivos .js
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Fechando processos Node.js...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo ✅ Processos fechados!
echo.
echo 🚀 Iniciando backend...
echo.
cd /d "%~dp0backend"
start cmd /k "npm start"

echo.
echo ✅ Backend iniciado em novo terminal!
echo.
echo 💡 Observe os logs no outro terminal para ver:
echo    "💾 ✅ Salvo na base de dados: [documento]"
echo.
pause







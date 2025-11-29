@echo off
chcp 65001 >nul
cls

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║     🌐 INICIANDO FRONTEND - PORTA 3000 🌐                ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0frontend"

echo 🚀 Iniciando frontend Next.js...
echo.
echo ⏰ Aguarde 20-30 segundos para compilar...
echo.
echo ✅ Quando ver "Ready on http://localhost:3000"
echo    você pode acessar o sistema!
echo.

npm run dev

pause





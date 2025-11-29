@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO NGROK (LOCAL)
echo ========================================
echo.

REM Verificar se o ngrok existe na pasta local
if not exist "ngrok\ngrok.exe" (
    echo ❌ NGROK não encontrado!
    echo.
    echo Por favor, execute primeiro: INSTALAR-NGROK.bat
    echo.
    pause
    exit /b 1
)

echo 📡 Expondo o backend na porta 3001...
echo.
echo ⚠️  IMPORTANTE:
echo    1. Copie a URL HTTPS gerada (ex: https://abc123.ngrok.io)
echo    2. Configure no Facebook: URL/api/webhook
echo    3. Mantenha esta janela ABERTA
echo.
echo ========================================
echo.

REM Executar o ngrok da pasta local
ngrok\ngrok.exe http 3001

pause






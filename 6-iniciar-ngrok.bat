@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO NGROK
echo ========================================
echo.
echo 📡 Expondo o backend na porta 3001...
echo.
echo ⚠️  IMPORTANTE:
echo    1. Copie a URL HTTPS gerada (ex: https://abc123.ngrok.io)
echo    2. Configure no Facebook: URL/api/webhook
echo    3. Mantenha esta janela ABERTA
echo.
echo ========================================
echo.

ngrok http 3001

pause






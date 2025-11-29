@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INSTALANDO NGROK
echo ========================================
echo.

echo 📥 Baixando ngrok...
echo.

REM Criar pasta para o ngrok
if not exist "ngrok" mkdir ngrok

REM Baixar ngrok usando PowerShell
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip' -OutFile 'ngrok\ngrok.zip'}"

echo.
echo 📦 Extraindo arquivos...
powershell -Command "Expand-Archive -Path 'ngrok\ngrok.zip' -DestinationPath 'ngrok' -Force"

echo.
echo 🗑️  Limpando arquivos temporários...
del /Q ngrok\ngrok.zip

echo.
echo ========================================
echo   ✅ NGROK INSTALADO COM SUCESSO!
echo ========================================
echo.
echo 📍 Localização: %CD%\ngrok\ngrok.exe
echo.
echo 🚀 Próximos passos:
echo    1. Execute: 8-iniciar-ngrok-local.bat
echo    2. OU navegue até a pasta 'ngrok' e execute: ngrok.exe http 3001
echo.
echo 💡 Opcional - Criar conta grátis:
echo    1. Acesse: https://dashboard.ngrok.com/signup
echo    2. Copie seu authtoken
echo    3. Execute: ngrok\ngrok.exe config add-authtoken SEU_TOKEN
echo.
pause






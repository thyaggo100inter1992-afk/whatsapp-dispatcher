@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO SISTEMA COMPLETO
echo ========================================
echo.

REM Verificar se o ngrok existe
if not exist "ngrok\ngrok.exe" (
    echo ❌ NGROK não encontrado!
    echo.
    echo Instalando ngrok agora...
    echo.
    call INSTALAR-NGROK.bat
    if errorlevel 1 (
        echo.
        echo ❌ Falha na instalação do ngrok!
        pause
        exit /b 1
    )
)

echo 📡 Passo 1: Iniciando NGROK...
start "NGROK - WhatsApp API" cmd /k "%CD%\ngrok\ngrok.exe http 3001"

echo ⏳ Aguardando 5 segundos para o ngrok iniciar...
timeout /t 5 /nobreak >nul

echo 🚀 Passo 2: Iniciando Backend...
start "Backend - WhatsApp API" cmd /k "cd backend && npm run dev"

echo ⏳ Aguardando 5 segundos para o backend iniciar...
timeout /t 5 /nobreak >nul

echo 💻 Passo 3: Iniciando Frontend...
start "Frontend - WhatsApp API" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   ✅ SISTEMA INICIADO COM SUCESSO!
echo ========================================
echo.
echo 📋 O que foi iniciado:
echo   1. NGROK     - Túnel para expor o backend
echo   2. Backend   - http://localhost:3001
echo   3. Frontend  - http://localhost:3000
echo.
echo 📡 IMPORTANTE - Configure o Webhook:
echo   1. Vá até a janela do NGROK
echo   2. Copie a URL HTTPS (ex: https://abc123.ngrok.io)
echo   3. Configure no Facebook Meta:
echo      - URL: https://abc123.ngrok.io/api/webhook
echo      - Verify Token: (o token do seu .env)
echo.
echo 🌐 Acesse o sistema em: http://localhost:3000
echo.
echo ⚠️  Mantenha todas as 3 janelas abertas!
echo    Feche-as para parar o sistema.
echo.
pause






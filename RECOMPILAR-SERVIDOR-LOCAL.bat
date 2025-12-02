@echo off
chcp 65001 > nul
echo.
echo 🛑 PARANDO SERVIDORES...
echo ========================================================
echo.

echo 🛑 Parando frontend e backend...
taskkill /F /IM node.exe 2>nul

timeout /t 2 /nobreak >nul

echo.
echo ✅ Servidores parados!
echo.
echo 🔨 Compilando backend...
cd backend
if exist dist rmdir /s /q dist
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERRO na compilação!
    pause
    exit /b 1
)

echo.
echo ✅ Compilação concluída!
echo.
echo 🚀 Agora execute:
echo    .\INICIAR-E-MONITORAR-SERVIDOR-LOCAL.bat
echo.
echo ========================================================
pause







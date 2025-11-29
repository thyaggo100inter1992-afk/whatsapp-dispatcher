@echo off
echo.
echo ========================================
echo   REINICIANDO BACKEND
echo ========================================
echo.

echo Finalizando processos na porta 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Finalizando PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo Aguardando 2 segundos...
timeout /t 2 /nobreak >nul

echo.
echo Iniciando backend...
echo.
cd backend
npm run dev

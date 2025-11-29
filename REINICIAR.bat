@echo off
echo.
echo ========================================
echo   REINICIANDO BACKEND
echo ========================================
echo.

echo Finalizando processos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

timeout /t 2 /nobreak >nul

echo Iniciando backend...
cd backend
start "Backend" cmd /k "npm run dev"

echo.
echo ========================================
echo   BACKEND INICIADO!
echo ========================================
echo.
echo Aguarde 5 segundos e recarregue o frontend (F5)
echo.
pause






@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO BACKEND E FRONTEND
echo ========================================
echo.

echo Iniciando Backend...
start "Backend - WhatsApp API" cmd /k "cd backend && npm run dev"

timeout /t 5 /nobreak >nul

echo Iniciando Frontend...
start "Frontend - WhatsApp API" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   SERVIDORES INICIADOS!
echo ========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Duas janelas foram abertas.
echo Feche-as para parar os servidores.
echo.
pause



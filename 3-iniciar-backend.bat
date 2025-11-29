@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO BACKEND
echo ========================================
echo.
echo Backend rodará em: http://localhost:3001
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

cd backend
call npm run dev

pause



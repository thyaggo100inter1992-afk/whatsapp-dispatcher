@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   INICIANDO FRONTEND
echo ========================================
echo.
echo Frontend rodará em: http://localhost:3000
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

cd frontend
call npm run dev

pause



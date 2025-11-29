@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   ✅ ERRO CORRIGIDO!
echo ========================================
echo.
echo O caminho de import estava errado:
echo   ❌ '../config/database'
echo   ✅ '../database/connection'
echo.
echo ========================================
echo   🚀 REINICIE O BACKEND AGORA
echo ========================================
echo.
echo 1. Vá na janela do backend
echo 2. Pressione Ctrl+C
echo 3. Execute: 3-iniciar-backend.bat
echo.
echo Ou execute aqui:
echo.
pause
echo.
echo Iniciando backend...
cd backend
npm run dev


@echo off
echo.
echo ========================================
echo    REINICIANDO BACKEND
echo ========================================
echo.
echo Fechando processo do backend (se estiver rodando)...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Limpando build antigo...
cd backend
if exist dist rmdir /s /q dist
echo.

echo Compilando TypeScript...
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo ERRO ao compilar! Verifique os erros acima.
  pause
  exit /b 1
)

echo.
echo ========================================
echo    INICIANDO BACKEND NA PORTA 3001
echo ========================================
echo.
echo O backend estara disponivel em: http://localhost:3001/api
echo Health check em: http://localhost:3001/api/health
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
call npm start

pause

@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   PARANDO PROCESSOS ANTIGOS...
echo ========================================
echo.

REM Mata processos na porta 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo 🔴 Parando processo %%a...
    taskkill /F /PID %%a >nul 2>&1
    echo ✅ Processo %%a finalizado!
)

echo ⏳ Aguardando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   INICIANDO BACKEND
echo ========================================
echo.
echo Backend rodará em: http://localhost:3001
echo.
echo ⚠️  NÃO FECHE ESTA JANELA!
echo ⚠️  Para parar o servidor, pressione Ctrl+C
echo.
cd backend
npm run dev


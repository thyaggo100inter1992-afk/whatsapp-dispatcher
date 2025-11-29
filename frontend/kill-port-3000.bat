@echo off
echo ========================================
echo   MATANDO PROCESSO NA PORTA 3000
echo ========================================
echo.

REM Encontrar o PID usando a porta 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Processo encontrado: PID %%a
    echo Encerrando processo...
    taskkill /F /PID %%a
    echo.
    echo ✅ Processo encerrado!
    goto :done
)

echo ⚠️  Nenhum processo encontrado na porta 3000

:done
echo.
pause



@echo off
echo.
echo ============================================
echo   MATANDO PROCESSO NA PORTA 3001
echo ============================================
echo.

echo Procurando processo na porta 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    set PID=%%a
    goto :found
)

:notfound
echo.
echo Nenhum processo encontrado na porta 3001
echo A porta esta livre! Voce pode iniciar o backend.
goto :end

:found
echo.
echo Processo encontrado! PID: %PID%
echo.
echo Matando processo %PID%...
taskkill /PID %PID% /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Processo finalizado com sucesso!
    echo Agora voce pode iniciar o backend com: npm run dev
) else (
    echo.
    echo Erro ao finalizar o processo.
    echo Tente executar este script como Administrador.
)

:end
echo.
pause


